import Image from "next/image";

export function Logo() {
  return (
    <div className="relative h-8 max-w-[10.847rem]">
      <Image
        src="/images/logo/logo.svg"
        fill
        className="dark:hidden"
        alt="Cognizes logo"
        role="presentation"
        quality={100}
      />

      <Image
        src="/images/logo/logo-dark.svg"
        fill
        className="hidden dark:block"
        alt="Cognizes logo"
        role="presentation"
        quality={100}
      />
    </div>
  );
}
