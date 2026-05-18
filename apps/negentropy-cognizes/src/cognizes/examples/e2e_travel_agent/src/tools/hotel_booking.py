"""
酒店预订工具 - 模拟实现
"""

from datetime import datetime
import random
import uuid

# 模拟酒店数据库
MOCK_HOTELS = {
    "DPS": [  # 巴厘岛
        {"name": "巴厘岛四季度假村", "star": 5, "base_price": 2800},
        {"name": "阿雅娜度假村", "star": 5, "base_price": 2200},
        {"name": "巴厘岛洲际酒店", "star": 5, "base_price": 1800},
    ],
    "BKK": [  # 曼谷
        {"name": "曼谷半岛酒店", "star": 5, "base_price": 1500},
        {"name": "曼谷悦榕庄", "star": 5, "base_price": 2000},
    ],
}


async def search_hotels(destination: str, checkin_date: str, checkout_date: str, guests: int = 2) -> list[dict]:
    """搜索酒店"""
    hotels = MOCK_HOTELS.get(destination.upper(), MOCK_HOTELS.get("DPS", []))
    results = []

    for hotel in hotels:
        results.append(
            {
                "hotel_id": str(uuid.uuid4())[:8],
                "name": hotel["name"],
                "star_rating": hotel["star"],
                "price_per_night": hotel["base_price"] + random.randint(-200, 200),
                "currency": "CNY",
                "checkin": checkin_date,
                "checkout": checkout_date,
                "guests": guests,
                "amenities": ["WiFi", "泳池", "早餐", "SPA"],
                "available_rooms": random.randint(1, 10),
            }
        )

    return results


async def book_hotel(hotel_id: str, guest_name: str, checkin_date: str, checkout_date: str) -> dict:
    """预订酒店"""
    return {
        "confirmation_code": f"HTL-{uuid.uuid4().hex[:8].upper()}",
        "hotel_id": hotel_id,
        "guest_name": guest_name,
        "checkin": checkin_date,
        "checkout": checkout_date,
        "status": "CONFIRMED",
        "message": "预订成功！确认邮件已发送。",
    }
