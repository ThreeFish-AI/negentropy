"""
航班查询工具 - 模拟实现
"""

from datetime import datetime, timedelta
import random


async def search_flights(origin: str, destination: str, departure_date: str, passengers: int = 1) -> list[dict]:
    """
    搜索航班信息

    Args:
        origin: 出发地城市代码 (如 PVG)
        destination: 目的地城市代码 (如 DPS)
        departure_date: 出发日期 (YYYY-MM-DD)
        passengers: 乘客数量

    Returns:
        航班列表
    """
    # 模拟航班数据
    airlines = ["国航", "东航", "南航", "新航", "国泰"]
    flights = []

    for i in range(3):
        dep_time = datetime.strptime(departure_date, "%Y-%m-%d") + timedelta(hours=8 + i * 3)
        flights.append(
            {
                "flight_no": f"{random.choice(['CA', 'MU', 'CZ', 'SQ', 'CX'])}{random.randint(100, 999)}",
                "airline": random.choice(airlines),
                "origin": origin,
                "destination": destination,
                "departure_time": dep_time.strftime("%Y-%m-%d %H:%M"),
                "arrival_time": (dep_time + timedelta(hours=random.randint(3, 8))).strftime("%Y-%m-%d %H:%M"),
                "price": random.randint(1500, 5000) * passengers,
                "currency": "CNY",
                "seats_available": random.randint(5, 50),
            }
        )

    return flights
