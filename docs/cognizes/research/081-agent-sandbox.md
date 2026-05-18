# **AI Agent 代码执行环境的正交分析报告：Microsandbox、Wasmtime、Firecracker 与 Google Vertex AI Agent Engine**

## **1. 执行摘要**

随着以大语言模型（LLM）为核心的智能体（AI Agent）技术的爆发式增长，计算基础设施正面临着前所未有的挑战。不同于传统的微服务或静态应用程序，AI Agent 的核心能力在于其**动态性**与**自主性**——它们能够根据自然语言指令实时生成代码、调用工具并执行复杂的推理任务。这种范式转变引入了独特的安全威胁模型：Agent 生成的代码本质上是不可信的，且具有高度的非确定性。如果在传统的容器化环境（如 Docker）中直接执行这些代码，共享内核的架构将使得宿主机面临极高的提权攻击、资源耗尽及横向移动风险。

本报告旨在对当前四种主流的、具有代表性的安全代码执行环境进行详尽的**正交分析（Orthogonal Analysis）**。这四种技术方案分别是：

1. **Microsandbox**：基于 libkrun 的开发者友好型 MicroVM 解决方案，旨在弥合容器易用性与虚拟化安全性之间的鸿沟。
2. **Wasmtime**：基于 WebAssembly 组件模型（Component Model）的下一代运行时，强调基于能力的安全性（Capability-based Security）与纳秒级冷启动。
3. **Firecracker**：AWS 开源的轻量级虚拟机监控器（VMM），代表了当前无服务器计算（Serverless）工业界的隔离标准。
4. **Google Vertex AI Agent Engine (Code Execution)**：Google Cloud 提供的全托管式代码执行服务，代表了基于 gVisor 等技术的企业级 SaaS/PaaS 解决方案。

本报告将摒弃单一的性能对比维度，转而采用多维度的正交分析框架，深入解构各方案在**隔离机制**、**系统架构**、**网络模型**、**状态管理**及**开发者生态**等核心轴线上的技术实现与权衡。分析显示，**Firecracker** 在硬件级隔离与资源密度方面占据统治地位，但其运维复杂性极高；**Microsandbox** 通过创新的透明套接字模拟（TSI）和 OCI 镜像兼容性，成功降低了 MicroVM 的使用门槛；**Wasmtime** 提供了理论上最优雅的“无共享”链接模型，但深受 Python 数据科学生态在 WASM 移植方面的成熟度制约；而 **Google Vertex AI** 则通过高度抽象的托管服务，以牺牲底层控制权为代价，换取了极致的合规性与集成度。

## **2. Agentic 计算范式与正交分析框架**

### **2.1 AI Agent 的运行时特征与威胁模型**

在深入技术细节之前，必须明确 AI Agent 对运行时环境的具体需求。与传统的 Web 服务不同，Agent 的工作负载具有以下显著特征：

- **短暂且高频的生命周期**：Agent 可能为了回答一个问题而生成一段 Python 脚本，运行时间仅为数百毫秒。这要求运行时环境必须具备极低的冷启动延迟（Cold Start Latency）。
- **敌对的多租户环境**：在多 Agent 系统中，成千上万个由不同用户指令驱动的 Agent 可能运行在同一物理节点上。任何单一 Agent 的逃逸都可能导致整个平台的崩溃。
- **重依赖的数据科学栈**：Agent 的代码执行通常涉及 pandas、numpy、scikit-learn 等依赖 C/C++ 扩展的重型库。这与仅运行简单逻辑的传统 Serverless 函数形成了鲜明对比。
- **状态持久化需求**：高级 Agent 需要在多轮对话中保持上下文（例如，保留上一轮加载的数据帧），这对无状态的 FaaS 架构提出了挑战。

### **2.2 正交分析维度的定义**

为了全面评估上述技术，我们建立以下正交分析维度：

1. **隔离轴（Isolation Axis）**：探讨系统边界的构建方式。是依赖 CPU 的硬件虚拟化指令（VT-x/AMD-V），还是依赖操作系统内核的软件拦截，亦或是依赖编译时的内存安全保证？
2. **抽象轴（Abstraction Axis）**：开发者如何交付代码？是基于层的 OCI 容器镜像，是扁平的根文件系统（Rootfs），还是编译后的二进制组件（WASM Component）？
3. **连接轴（Connectivity Axis）**：沙箱内外部的网络通信如何实现？是基于虚拟网卡（TAP/TUN）的桥接，还是用户态的协议栈模拟，亦或是基于能力的显式授权？
4. **生态轴（Ecosystem Axis）**：对现有编程语言标准库及第三方生态（尤其是 Python PyPI）的兼容程度。

## **3. Microsandbox：基于 Libkrun 的库操作系统化虚拟化**

**Microsandbox**（由 zerocore-ai 开发）代表了虚拟化技术消费模式的一种演进。如果说 Firecracker 是面向云服务商的基础设施原语，那么 Microsandbox 则是面向应用开发者的“嵌入式”虚拟化解决方案。其核心设计理念是：在保持 MicroVM 级别的硬件隔离的同时，提供如同 Docker 般的开发者体验 1。

### **3.1 核心架构：Libkrun 的动态库设计**

Microsandbox 的技术基石是 **libkrun**。这是一个基于 Rust 编写的动态库，旨在抽象 KVM（Linux）和 HVF（macOS）的虚拟化能力 3。

#### **3.1.1 进程模型的革新**

传统的虚拟化方案（如 QEMU 或 Firecracker）通常作为一个独立的进程运行，宿主程序通过 Socket API 与其通信。这种模式在架构上引入了明显的进程间通信（IPC）开销和管理复杂性。  
相比之下，libkrun 将虚拟机监控器（VMM）的功能封装为一个动态链接库（.so 或 .dylib）。这意味着：

- **应用内虚拟化**：Microsandbox 的二进制文件 msb 在启动时，直接通过加载 libkrun 库在当前进程空间内初始化 VMM。
- **减少上下文切换**：VMM 与控制逻辑处于同一地址空间，减少了系统调用的开销。
- **极简设备模型**：libkrun 仅实现了运行 Linux 内核所需的最小设备集（Virtio-net, Virtio-blk, Virtio-fs 等），去除了传统 VMM 中庞大的遗留设备模拟代码 4。

这种设计使得 Microsandbox 能够实现 **<200ms** 的启动时间，虽然略慢于极致优化的 Firecracker（~125ms），但远快于传统容器的冷启动（在需拉取镜像时）和标准 VM 的秒级启动 5。

### **3.2 文件系统架构：OCI 镜像与 Virtio-fs 的融合**

AI Agent 开发者的主流工作流是基于 Docker/OCI 镜像的。Firecracker 的一大痛点在于它默认需要块设备（Block Device）格式的根文件系统（rootfs），这迫使开发者必须将分层的 Docker 镜像“扁平化”为单一的磁盘镜像文件，这一过程既耗时又浪费存储空间 6。

Microsandbox 通过深度集成 **virtio-fs** 解决了这一正交性冲突：

1. **分层挂载**：Microsandbox 能够直接利用宿主机上已解压的 OCI 镜像层（Layers）。
2. **DAX（Direct Access）机制**：利用 virtio-fs 的 DAX 特性，客户机内核（Guest Kernel）可以直接映射宿主机的页面缓存（Page Cache）到虚拟机的内存空间。这意味着文件读取操作无需经过昂贵的内存拷贝，且多个沙箱实例可以共享只读的基础镜像层内存，极大地提高了内存密度 7。
3. **即时启动**：由于无需预先加载整个磁盘镜像到内存，VM 可以在内核加载完毕后立即启动，文件内容仅在被访问时按需分页（Page-in）。

### **3.3 网络模型创新：透明套接字模拟 (TSI)**

Microsandbox 在网络连接轴上引入了极具创新性的 **透明套接字模拟（Transparent Socket Impersonation, TSI）** 技术 3。

#### **3.3.1 传统困境 vs TSI 方案**

在 Firecracker 或 QEMU 中，网络通常通过宿主机的 TAP 设备和网桥（Bridge）来实现。这要求宿主机配置复杂的 iptables 规则进行 NAT 转发，且通常需要 Root 权限来创建网络接口。这种“管道工”式的配置对于只想运行代码的开发者来说是巨大的负担。

TSI 采用了一种完全不同的用户态网络栈思路：

- **无虚拟网卡**：在 Guest VM 内部，并没有传统的 eth0 网络接口连接到宿主机的网桥。
- **系统调用拦截**：当 Guest 内的应用程序发起 connect() 或 bind() 等 Socket 系统调用时，libkrun 提供的特殊驱动或拦截机制会捕获这些请求。
- **宿主代理执行**：这些请求被转发到宿主机进程（Microsandbox 进程）。宿主机进程随后使用其自身的网络栈，以普通用户态进程的身份发起相应的网络连接。

#### **3.3.2 TSI 的优势与局限**

- **优势**：
  - **零配置网络**：沙箱内的网络视图与宿主机进程完全一致。例如，如果宿主机能访问 localhost:8080 的数据库，沙箱内的 Agent 也可以直接访问（视具体实现细节而定），无需配置端口转发。
  - **安全性**：对于外部防火墙而言，流量看起来直接来自 Microsandbox 进程，易于监控和审计。
  - **非特权运行**：无需 Root 权限即可实现网络连接。
- **局限**：
  - **协议支持有限**：正如 8 和 4 指出的，TSI 目前主要支持 IPv4 的 TCP 和 UDP。对于 ICMP（Ping）、原始套接字（Raw Sockets）或复杂的网络协议，支持尚不完善。
  - **兼容性边缘情况**：某些依赖特定网络接口行为的应用可能会在 TSI 环境下表现异常。

## **4. Firecracker：超大规模基础设施的极简主义标准**

**Firecracker** 是 AWS 为了解决 Lambda 和 Fargate 服务的多租户隔离问题而构建的。它的设计哲学是 **“极简主义（Minimalism）”**——只保留运行云原生负载所需的绝对最小功能集。在正交分析中，Firecracker 代表了硬件隔离轴上的极致 9。

### **4.1 核心架构：MicroVM 与 Jailer**

Firecracker 并非通用的虚拟机管理器，它是一个专用且死板的 VMM。

#### **4.1.1 极简设备模型**

为了减少攻击面和内存开销（每个 MicroVM 约 5MB），Firecracker 剔除了 PCI 总线、BIOS、UEFI 以及所有传统的 I/O 设备模拟。它仅支持基于 MMIO（内存映射 I/O）发现的 Virtio 设备：

- virtio-net：网络设备。
- virtio-block：块存储设备。
- virtio-vsock：宿主机与客机通信的 Socket。
- serial console：唯一的输出控制台。

这种设计使得 Firecracker 极其轻量，但也意味着它无法运行需要特定硬件驱动的遗留操作系统，也**不支持 GPU 直通（PCI Passthrough）**。对于需要进行本地模型推理（Inference）或大规模矩阵运算的 AI Agent，这是一个致命的限制，除非完全依赖 CPU 计算 10。

#### **4.1.2 Jailer 的纵深防御**

Firecracker 的安全性不仅依赖于 KVM 提供的 Guest/Host 隔离，还引入了一个名为 **Jailer** 的外部组件 11。Jailer 在 Firecracker 进程启动之前执行以下操作：

1. **Chroot**：将进程根目录锁定在特定路径。
2. **Namespace 隔离**：创建独立的 PID、Network、IPC 命名空间。
3. **Cgroups 限制**：严格限制 CPU 和内存资源。
4. **Seccomp 过滤**：这是最关键的一环。Firecracker 进程被限制只能调用宿主机内核的极少数系统调用（Syscalls）。

这种多层防御体系确保了即使攻击者利用 KVM 漏洞逃逸出虚拟机，他们也会被困在一个极度受限的宿主机进程中，无法对宿主系统造成实质性破坏。

### **4.2 Firecracker 与 QEMU 的对比分析**

在研究资料 10 中，Firecracker 与 QEMU 的对比是一个核心议题。

| 特性           | Firecracker        | QEMU                                | 对 AI Agent 的影响                                                            |
| :------------- | :----------------- | :---------------------------------- | :---------------------------------------------------------------------------- |
| **代码库规模** | ~5 万行 (Rust)     | >100 万行 (C)                       | Firecracker 攻击面极小，审计更容易。                                          |
| **启动时间**   | ~125ms             | 秒级 (标准) / ~500ms (MicroVM 模式) | Firecracker 更适合即时响应的 Agent 代码执行。                                 |
| **设备支持**   | 仅 Virtio (无 PCI) | 极其广泛 (含 GPU, USB 等)           | QEMU 支持 GPU 直通，适合重型 AI 推理；Firecracker 仅适合 CPU 逻辑或轻量计算。 |
| **内存开销**   | < 5MB              | 数十 MB                             | Firecracker 允许在单机上高密度部署数千个 Agent 沙箱。                         |
| **语言安全性** | Rust (内存安全)    | C (潜在内存漏洞)                    | Firecracker 自身更难被缓冲区溢出等漏洞利用。                                  |

对于绝大多数不需要本地 GPU 推理的 Agent 代码执行任务（主要是逻辑控制、API 调用、数据处理），Firecracker 提供了远优于 QEMU 的安全/性能比。

### **4.3 运维复杂性与生态缺失**

Firecracker 的主要缺点在于其“非即插即用”的特性。它不直接支持 Docker 镜像，不提供高级的网络管理功能。在构建 AI Agent 平台时，直接使用 Firecracker 意味着需要自行构建庞大的编排系统（Orchestration System）来处理镜像转换、网络 IP 分配（IPAM）、存储卷挂载等问题 12。这正是 Microsandbox 试图解决的问题领域。

## **5. Wasmtime：基于组件模型的下一代能力安全运行时**

**Wasmtime**（由 Bytecode Alliance 主导）在正交分析中占据了一个完全不同的位置。它不依赖硬件虚拟化（KVM），而是依赖**WebAssembly (WASM)** 的软件故障隔离（SFI）和类型安全机制 13。

### **5.1 组件模型（Component Model）与无共享链接**

Wasmtime 实现了 WASM 的 **组件模型（Component Model）**，这是 WebAssembly 的一项重大演进 15。

- **模块 vs 组件**：传统的 WASM 模块类似于简单的动态库，它们共享线性内存。而组件是更高级的封装，它们之间通过强类型的接口（WIT - Wasm Interface Type）进行通信。
- **无共享架构（Shared-Nothing）**：当组件 A 调用组件 B 时，它们不共享内存地址空间。所有的数据传递都通过接口类型的拷贝或句柄（Handle）传递。这意味着即使组件 B 被攻破，它也无法读取组件 A 的内存数据。
- **纳秒级实例化**：由于 WASM 运行时仅需初始化内存结构而无需启动操作系统内核，Wasmtime 的实例化速度可以达到微秒甚至纳秒级。这允许采用“纳进程（Nanoprocess）”架构，即每个 Agent 的每一次函数调用都可以在一个全新的、干净的沙箱中运行 17。

### **5.2 基于能力的安全性（Capability-based Security）**

Wasmtime 严格遵循 **WASI（WebAssembly System Interface）** 标准，实施“默认拒绝”的安全策略 18。

- **显式授权**：WASM 字节码本身无法进行任何系统调用（如打开文件、网络请求）。它必须通过宿主机注入的“能力（Capabilities）”来执行这些操作。
- **细粒度控制**：宿主机可以精确地授予 Agent 只读访问 /data/input 目录和向 api.example.com 发起 HTTP 请求的权限，而无需像 Docker 那样依赖粗粒度的 CAP_NET_ADMIN 或文件系统挂载。

### **5.3 Python 生态的“阿喀琉斯之踵”**

尽管架构优雅，但在 AI Agent 领域，Wasmtime 面临着巨大的生态挑战：**Python 支持** 19。

#### **5.3.1 Pyodide 与 Componentize-py**

Agent 代码主要由 Python 编写，且严重依赖 pandas、numpy 等 C 扩展库。

- **编译难题**：WASM 是一种不同的指令集架构。标准的 PyPI Wheel 包（如 numpy-cp39-manylinux_x86_64.whl）无法在 WASM 中运行。所有包含 C 代码的库都必须针对 wasm32-wasi 目标进行交叉编译。
- **Componentize-py**：为了在 Wasmtime 中运行 Python，通常使用 componentize-py 工具 22。该工具将 Python 解释器（CPython 编译为 WASM）与用户的 Python 代码以及依赖库打包成一个单一的 WASM 组件。
- **性能双重惩罚**：运行在 WASM 中的 Python 本质上是“解释器运行在虚拟机上”。虽然 WASM 本身接近原生速度，但 CPython 解释器的指令分发（Dispatch）在 WASM 中会引入显著的性能开销。
- **网络栈缺失**：标准的 Python socket 库在 WASI 环境下功能受限。虽然 wasi-sockets 提案正在推进，但目前许多 Python 网络库（如 requests, urllib3）在服务器端 WASM 运行时中仍需大量魔改或依赖宿主机函数注入才能工作 17。

#### **5.3.2 WASI-NN：AI 推理的曙光**

为了解决性能问题，**wasi-nn** 提案允许 WASM 模块通过接口调用宿主机的机器学习推理引擎（如 OpenVINO, TensorFlow Lite）24。这使得 Agent 可以将重型的矩阵运算卸载给宿主机（甚至利用宿主机的 GPU），而仅在 WASM 中运行轻量的控制逻辑。这是一个极具潜力的方向，但目前仍处于早期阶段。

## **6. Google Vertex AI Agent Engine：全托管的企业级沙箱**

Google 的 **Vertex AI Agent Engine (Code Execution)** 代表了 SaaS/PaaS 层面的解决方案。它不再让用户关注底层的 VMM 或运行时，而是提供一个封装好的 API 26。

### **6.1 架构推测：基于 gVisor 的应用内核**

虽然 Google 未公开其确切的底层实现，但基于 Google 在容器安全领域的布局（Cloud Run, GKE Sandbox）以及相关研究 28，可以高度确信其核心技术栈基于 **gVisor**。

#### **6.1.1 gVisor 的拦截机制**

gVisor 与 Firecracker 不同，它不运行完整的 Guest Kernel。

- **Sentry**：gVisor 运行一个名为 Sentry 的用户态内核（用 Go 编写）。它拦截应用程序的所有系统调用（Syscalls）。
- **Gofer**：处理文件系统操作的独立进程。
- **隔离边界**：当 Agent 代码尝试执行 open() 或 socket() 时，这些调用被 Sentry 捕获并模拟，而不是直接传递给宿主机 Linux 内核。这在应用程序和宿主机内核之间建立了一道厚重的软件防火墙。

#### **6.1.2 性能权衡**

gVisor 的正交权衡在于：**系统调用开销 vs 兼容性**。

- 相比于 Firecracker 的硬件虚拟化，gVisor 在拦截和模拟系统调用时会产生更大的 CPU 开销，特别是对于 I/O 密集型操作（如大量小文件读写或高频网络请求）。
- 但是，gVisor 提供了比 WASM 更好的兼容性，因为它旨在模拟完整的 Linux ABI，大多数现有的 x86_64 二进制文件（包括标准的 Python 库）都可以直接运行，无需重新编译 31。

### **6.2 企业级特性：状态、合规与集成**

Vertex AI Agent Engine 的真正优势在于其构建在沙箱之上的企业级特性 26：

1. **VPC Service Controls (VPC-SC)**：这是企业客户的核心需求。它允许沙箱环境接入企业的私有网络（VPC），访问内部的 BigQuery 数据仓库或内部 API，同时通过严格的边界策略防止数据通过公网渗漏。这是自建 Firecracker 集群极难实现的。
2. **有状态会话（Stateful Sessions）**：Vertex AI 支持长达 14 天的会话保持。Agent 可以在第一次交互中下载并清洗数据，生成一个 Pandas DataFrame 对象驻留在内存中；在随后的交互中，直接对该对象进行操作，而无需重新加载数据。这种“有状态性”对于数据分析类 Agent 至关重要 33。
3. **合规性**：内置支持 HIPAA、CMEK（客户管理加密密钥）和数据驻留（Data Residency）策略，解决了企业落地的合规痛点。

## **7. 比较性能与安全分析**

### **7.1 启动延迟与吞吐量基准**

| 平台              | 冷启动延迟    | 吞吐量 (Throughput)           | 内存开销         | 分析                                                                             |
| :---------------- | :------------ | :---------------------------- | :--------------- | :------------------------------------------------------------------------------- |
| **Wasmtime**      | **< 5ms**     | 原生 (Rust/C++) / 慢 (Python) | **极低 (KB 级)** | 启动最快，适合高频短任务。Python 性能受解释器开销影响大。                        |
| **Firecracker**   | ~125ms        | 近原生 (CPU) / 受限 (I/O)     | 低 (~5MB)        | 工业界标准，平衡了启动速度与运行时性能。I/O 性能受 Virtio 实现限制。             |
| **Microsandbox**  | < 200ms       | 近原生 (CPU) / 受限 (TSI)     | 中低             | 引入了 OCI 镜像处理和 TSI 开销，略慢于纯 Firecracker，但仍处于毫秒级。           |
| **Google Vertex** | 亚秒级 - 秒级 | 中等 (Syscall 开销大)         | 未知 (托管)      | 受网络 RTT 和调度影响，延迟最高。gVisor 的 Syscall 拦截导致 I/O 密集型任务变慢。 |

5 的基准测试数据支持上述结论。gVisor 在涉及大量文件操作（如 pip install 或解压大数据集）时性能显著下降，而 MicroVM 方案（Firecracker/Microsandbox）在这些场景下表现更优。

### **7.2 攻击面与隔离强度**

1. **硬件墙 (Firecracker/Microsandbox)**：
   - **依赖**：CPU VT-x/AMD-V 指令集。
   - **风险**：侧信道攻击（Spectre/Meltdown）。Firecracker 强制禁用超线程（SMT）来缓解此风险，这会降低 CPU 资源的利用率。Hypervisor 逃逸漏洞极其罕见但致命 10。
2. **软件墙 (Wasmtime)**：
   - **依赖**：JIT 编译器（Cranelift）的正确性和内存安全验证。
   - **风险**：JIT 编译器漏洞。如果攻击者能构造特定的 WASM 字节码触发 JIT 错误，可能实现沙箱逃逸。但由于没有内核接口，攻击者无法利用传统的内核漏洞（如 Dirty COW）18。
3. **拦截墙 (Google Vertex/gVisor)**：
   - **依赖**：Sentry 内核的逻辑完备性。
   - **风险**：Sentry 实现漏洞。由于 Sentry 是用 Go 编写的内存安全程序，缓冲区溢出风险较低，但逻辑错误可能导致绕过。其安全性被认为强于容器，但弱于硬件虚拟化 28。

## **8. 决策框架与战略建议**

基于上述正交分析，我们为 AI 基础设施架构师提供以下决策框架：

### **8.1 场景一：企业级数据分析 Agent (Buy Strategy)**

**推荐方案：Google Vertex AI Agent Engine**

- **理由**：如果 Agent 需要处理敏感的财务数据或医疗记录，**合规性**和**防数据泄露**是第一要务。Vertex AI 提供的 VPC-SC 和 CMEK 集成是自建方案难以企及的。有状态会话特性也非常适合需要多轮交互的数据清洗任务。
- **权衡**：放弃了对底层运行时的控制权，且需承担较高的云服务溢价。

### **8.2 场景二：高性能、自托管的 Agent 平台 (Build Strategy)**

**推荐方案：Microsandbox**

- **理由**：对于初创公司或构建内部 Agent 平台的团队，Microsandbox 提供了**最佳的投入产出比**。它复用了现有的 Docker 生态（无需重写 Dockerfile），提供了接近 Firecracker 的安全性，且 TSI 网络模型简化了私有部署的网络配置。它是构建“Agent-as-a-Service”平台的理想基石 2。

### **8.3 场景三：极高并发的逻辑编排 Agent (Future Strategy)**

**推荐方案：Wasmtime**

- **理由**：如果 Agent 的任务主要是轻量级的逻辑判断、字符串处理或调用外部 API（充当胶水层），且需要处理每秒数万次的请求，Wasmtime 的纳秒级启动和极低内存占用是无敌的。
- **警告**：目前需规避重依赖 Python C 扩展的场景，或者投入资源进行 WASM 移植和优化 17。

### **8.4 场景四：公有云基础设施底层 (Platform Strategy)**

**推荐方案：Firecracker**

- **理由**：如果你是 AWS、Cloudflare 或 E2B 这样的基础设施提供商，需要构建一个支持任意代码执行的通用平台，Firecracker 是唯一经过超大规模验证的选择。其极简主义和 Jailer 机制提供了最高的安全上限和资源超卖能力。

## **9. 结论**

AI Agent 的代码执行环境之争，本质上是**隔离性**、**易用性**与**生态兼容性**的三难选择。

- **Firecracker** 赢得了硬件隔离的安全性，但输在了易用性。
- **Wasmtime** 赢得了启动速度和理论安全性，但输在了当前的 Python 生态支持。
- **Microsandbox** 通过库级虚拟化和 OCI 兼容，成功地在 Firecracker 和 Docker 之间找到了一个平衡点，是目前最适合自建 Agent 平台的务实选择。
- **Google Vertex AI** 则证明了在企业级市场，全托管的集成体验和合规性保障往往比单纯的技术指标更具价值。

架构师应根据具体的业务场景——是侧重于数据科学的兼容性（选 Microsandbox/Vertex），还是侧重于极致的并发与冷启动（选 Wasmtime/Firecracker）——来做出最终的技术选型。

---

引用索引：

1

## **Works cited**

1. zerocore-ai/microsandbox: opensource self-hosted ... - GitHub, accessed January 7, 2026, [https://github.com/zerocore-ai/microsandbox](https://github.com/zerocore-ai/microsandbox)
2. Microsandbox: Solving the Code Execution Security Dilemma | by Simardeep Singh, accessed January 7, 2026, [https://medium.com/@simardeep.oberoi/microsandbox-solving-the-code-execution-security-dilemma-4e3ea9138ef8](https://medium.com/@simardeep.oberoi/microsandbox-solving-the-code-execution-security-dilemma-4e3ea9138ef8)
3. UbuntuAsahi/libkrun - GitHub, accessed January 7, 2026, [https://github.com/UbuntuAsahi/libkrun](https://github.com/UbuntuAsahi/libkrun)
4. containers/libkrun: A dynamic library providing Virtualization-based process isolation capabilities - GitHub, accessed January 7, 2026, [https://github.com/containers/libkrun](https://github.com/containers/libkrun)
5. AI Sandboxes: Daytona vs microsandbox - Pixeljets, accessed January 7, 2026, [https://pixeljets.com/blog/ai-sandboxes-daytona-vs-microsandbox/?utm_source=seoca](https://pixeljets.com/blog/ai-sandboxes-daytona-vs-microsandbox/?utm_source=seoca)
6. Self-Hosted Sandboxes: How to Pick Between Containers and MicroVMs | by Dafe - Medium, accessed January 7, 2026, [https://medium.com/@odafe41/self-hosted-sandboxes-how-to-pick-between-containers-and-microvms-1fa4803b7bdf](https://medium.com/@odafe41/self-hosted-sandboxes-how-to-pick-between-containers-and-microvms-1fa4803b7bdf)
7. libkrun: Virtualization-based isolation for your workloads - Sched, accessed January 7, 2026, [https://static.sched.com/hosted_files/devconfcz2021/b9/libkrun%20Virtuailzation-based%20isolation%20for%20your%20workloads.pdf](https://static.sched.com/hosted_files/devconfcz2021/b9/libkrun%20Virtuailzation-based%20isolation%20for%20your%20workloads.pdf)
8. AI Sandboxes: Daytona vs microsandbox - Pixeljets, accessed January 7, 2026, [https://pixeljets.com/blog/ai-sandboxes-daytona-vs-microsandbox/](https://pixeljets.com/blog/ai-sandboxes-daytona-vs-microsandbox/)
9. MicroVMs: Scaling Out Over Scaling Up in Modern Cloud Architectures | OpenMetal IaaS, accessed January 7, 2026, [https://openmetal.io/resources/blog/microvms-scaling-out-over-scaling-up/](https://openmetal.io/resources/blog/microvms-scaling-out-over-scaling-up/)
10. Firecracker vs QEMU — E2B Blog, accessed January 7, 2026, [https://e2b.dev/blog/firecracker-vs-qemu](https://e2b.dev/blog/firecracker-vs-qemu)
11. A field guide to sandboxes for AI - Luis Cardoso, accessed January 7, 2026, [https://www.luiscardoso.dev/blog/sandboxes-for-ai](https://www.luiscardoso.dev/blog/sandboxes-for-ai)
12. Open-Source Alternatives to E2B for Sandboxed Code Execution - Beam Cloud, accessed January 7, 2026, [https://www.beam.cloud/blog/best-e2b-alternatives](https://www.beam.cloud/blog/best-e2b-alternatives)
13. Bytecode Alliance — Projects, accessed January 7, 2026, [https://bytecodealliance.org/projects](https://bytecodealliance.org/projects)
14. bytecodealliance/wasmtime: A lightweight WebAssembly runtime that is fast, secure, and standards-compliant - GitHub, accessed January 7, 2026, [https://github.com/bytecodealliance/wasmtime](https://github.com/bytecodealliance/wasmtime)
15. Creating runnable components - The WebAssembly Component Model, accessed January 7, 2026, [https://component-model.bytecodealliance.org/creating-runnable-components.html](https://component-model.bytecodealliance.org/creating-runnable-components.html)
16. component-model/design/mvp/Explainer.md at main - GitHub, accessed January 7, 2026, [https://github.com/WebAssembly/component-model/blob/main/design/mvp/Explainer.md](https://github.com/WebAssembly/component-model/blob/main/design/mvp/Explainer.md)
17. WebAssembly/wasi-sockets: WASI API proposal for managing sockets - GitHub, accessed January 7, 2026, [https://github.com/WebAssembly/wasi-sockets](https://github.com/WebAssembly/wasi-sockets)
18. Security - Wasmtime, accessed January 7, 2026, [https://docs.wasmtime.dev/security.html](https://docs.wasmtime.dev/security.html)
19. Adding Python WASI support to Wasm Language Runtimes, accessed January 7, 2026, [https://wasmlabs.dev/articles/python-wasm32-wasi/](https://wasmlabs.dev/articles/python-wasm32-wasi/)
20. Differences Between python-wasm and Pyodide - CoCalc, accessed January 7, 2026, [https://cocalc.com/github/sagemathinc/wapython/blob/main/docs/differences-from-pyodide.md](https://cocalc.com/github/sagemathinc/wapython/blob/main/docs/differences-from-pyodide.md)
21. Bringing Python to Workers using Pyodide and WebAssembly - The Cloudflare Blog, accessed January 7, 2026, [https://blog.cloudflare.com/python-workers/](https://blog.cloudflare.com/python-workers/)
22. bytecodealliance/componentize-py: Tool for targetting the WebAssembly Component Model using Python - GitHub, accessed January 7, 2026, [https://github.com/bytecodealliance/componentize-py](https://github.com/bytecodealliance/componentize-py)
23. Python - The WebAssembly Component Model, accessed January 7, 2026, [https://component-model.bytecodealliance.org/language-support/python.html](https://component-model.bytecodealliance.org/language-support/python.html)
24. wasmtime-wasi-nn - crates.io: Rust Package Registry, accessed January 7, 2026, [https://crates.io/crates/wasmtime-wasi-nn](https://crates.io/crates/wasmtime-wasi-nn)
25. WebAssembly/wasi-nn: Neural Network proposal for WASI - GitHub, accessed January 7, 2026, [https://github.com/WebAssembly/wasi-nn](https://github.com/WebAssembly/wasi-nn)
26. Vertex AI Agent Engine overview - Google Cloud Documentation, accessed January 7, 2026, [https://docs.cloud.google.com/agent-builder/agent-engine/overview](https://docs.cloud.google.com/agent-builder/agent-engine/overview)
27. Building Scalable AI Agents: Design Patterns With Agent Engine On Google Cloud, accessed January 7, 2026, [https://cloud.google.com/blog/topics/partners/building-scalable-ai-agents-design-patterns-with-agent-engine-on-google-cloud](https://cloud.google.com/blog/topics/partners/building-scalable-ai-agents-design-patterns-with-agent-engine-on-google-cloud)
28. Choosing a Workspace for AI Agents: The Ultimate Showdown Between gVisor, Kata, and Firecracker - DEV Community, accessed January 7, 2026, [https://dev.to/agentsphere/choosing-a-workspace-for-ai-agents-the-ultimate-showdown-between-gvisor-kata-and-firecracker-b10](https://dev.to/agentsphere/choosing-a-workspace-for-ai-agents-the-ultimate-showdown-between-gvisor-kata-and-firecracker-b10)
29. Kata Containers vs Firecracker vs gvisor : r/docker - Reddit, accessed January 7, 2026, [https://www.reddit.com/r/docker/comments/1fmuv5b/kata_containers_vs_firecracker_vs_gvisor/](https://www.reddit.com/r/docker/comments/1fmuv5b/kata_containers_vs_firecracker_vs_gvisor/)
30. Agent Factory Recap: Supercharging Agents on GKE with Agent Sandbox and Pod Snapshots | Google Cloud Blog, accessed January 7, 2026, [https://cloud.google.com/blog/topics/developers-practitioners/agent-factory-recap-supercharging-agents-on-gke-with-agent-sandbox-and-pod-snapshots](https://cloud.google.com/blog/topics/developers-practitioners/agent-factory-recap-supercharging-agents-on-gke-with-agent-sandbox-and-pod-snapshots)
31. Security-Performance Trade-offs of Kubernetes Container Runtimes - Cristian Klein, accessed January 7, 2026, [https://cristian.kleinlabs.eu/publications/mascots2020_container_runtime_security.pdf](https://cristian.kleinlabs.eu/publications/mascots2020_container_runtime_security.pdf)
32. Impact of Secure Container Runtimes on File I/O Performance in Edge Computing - MDPI, accessed January 7, 2026, [https://www.mdpi.com/2076-3417/13/24/13329](https://www.mdpi.com/2076-3417/13/24/13329)
33. Agent Engine Code Execution | Vertex AI Agent Builder - Google Cloud Documentation, accessed January 7, 2026, [https://docs.cloud.google.com/agent-builder/agent-engine/code-execution/overview](https://docs.cloud.google.com/agent-builder/agent-engine/code-execution/overview)
34. Security Without Sacrifice: Edera Performance Benchmarking, accessed January 7, 2026, [https://edera.dev/stories/security-without-sacrifice-edera-performance-benchmarking](https://edera.dev/stories/security-without-sacrifice-edera-performance-benchmarking)
35. The Great Virtualization-Container-Sandbox Race - Development - Whonix Forum, accessed January 7, 2026, [https://forums.whonix.org/t/the-great-virtualization-container-sandbox-race/22243](https://forums.whonix.org/t/the-great-virtualization-container-sandbox-race/22243)
36. Is the Wasm's Component Model/ Wasip2 is already dead? : r/rust - Reddit, accessed January 7, 2026, [https://www.reddit.com/r/rust/comments/1nld2a7/is_the_wasms_component_model_wasip2_is_already/](https://www.reddit.com/r/rust/comments/1nld2a7/is_the_wasms_component_model_wasip2_is_already/)
37. Introducing Code Execution: The code sandbox for your agents on Vertex AI Agent Engine, accessed January 7, 2026, [https://discuss.google.dev/t/introducing-code-execution-the-code-sandbox-for-your-agents-on-vertex-ai-agent-engine/264336](https://discuss.google.dev/t/introducing-code-execution-the-code-sandbox-for-your-agents-on-vertex-ai-agent-engine/264336)
38. Pull requests · zerocore-ai/microsandbox - GitHub, accessed January 7, 2026, [https://github.com/zerocore-ai/microsandbox/pulls](https://github.com/zerocore-ai/microsandbox/pulls)
39. WASI and the WebAssembly Component Model: Current Status - eunomia-bpf, accessed January 7, 2026, [https://eunomia.dev/blog/2025/02/16/wasi-and-the-webassembly-component-model-current-status/](https://eunomia.dev/blog/2025/02/16/wasi-and-the-webassembly-component-model-current-status/)
40. Pyodide - Blueprints - Mozilla.ai, accessed January 7, 2026, [https://blueprints.mozilla.ai/tools/pyodide](https://blueprints.mozilla.ai/tools/pyodide)
41. How Night Core Worker Uses Rust and Firecracker to Run Verified WebAssembly Modules in Isolated MicroVMs : r/learnrust - Reddit, accessed January 7, 2026, [https://www.reddit.com/r/learnrust/comments/1oseidb/how_night_core_worker_uses_rust_and_firecracker/](https://www.reddit.com/r/learnrust/comments/1oseidb/how_night_core_worker_uses_rust_and_firecracker/)
42. Introduction to VirtIO, Part 2: Vhost | linux - Oracle Blogs, accessed January 7, 2026, [https://blogs.oracle.com/linux/introduction-to-virtio-part-2-vhost](https://blogs.oracle.com/linux/introduction-to-virtio-part-2-vhost)
43. restyler/awesome-sandbox: Awesome Code Sandboxing for AI - GitHub, accessed January 7, 2026, [https://github.com/restyler/awesome-sandbox](https://github.com/restyler/awesome-sandbox)
44. wasmtime - PyPI, accessed January 7, 2026, [https://pypi.org/project/wasmtime/](https://pypi.org/project/wasmtime/)
45. Sandboxing Python Code Execution with WASM - Atlantbh Sarajevo, accessed January 7, 2026, [https://www.atlantbh.com/sandboxing-python-code-execution-with-wasm/](https://www.atlantbh.com/sandboxing-python-code-execution-with-wasm/)
46. Pyodide is a Python distribution for the browser and Node.js based on WebAssembly - GitHub, accessed January 7, 2026, [https://github.com/pyodide/pyodide](https://github.com/pyodide/pyodide)
47. Write Python. Run Wasm. - Medium, accessed January 7, 2026, [https://medium.com/wasm/write-python-run-wasm-67663ffceb47](https://medium.com/wasm/write-python-run-wasm-67663ffceb47)
48. What is the difference between Ignite and gVisor in terms of their use-case? - Stack Overflow, accessed January 7, 2026, [https://stackoverflow.com/questions/56996602/what-is-the-difference-between-ignite-and-gvisor-in-terms-of-their-use-case](https://stackoverflow.com/questions/56996602/what-is-the-difference-between-ignite-and-gvisor-in-terms-of-their-use-case)
