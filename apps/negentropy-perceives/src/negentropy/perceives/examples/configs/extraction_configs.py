"""
高级提取配置示例。

本文件提供多种网站类型的提取配置模板，展示抓取系统的灵活性。
每个配置字典可直接作为 parse_webpage_to_markdown 工具的 custom_options 参数使用。
"""

from typing import Any


# ---------------------------------------------------------------------------
# 字段构建器（内部辅助函数）
# ---------------------------------------------------------------------------
def _text(selector: str) -> dict[str, Any]:
    """构建单文本字段配置。"""
    return {"selector": selector, "attr": "text", "multiple": False}


def _text_list(selector: str) -> dict[str, Any]:
    """构建多文本字段配置。"""
    return {"selector": selector, "attr": "text", "multiple": True}


def _attr(selector: str, attr: str) -> dict[str, Any]:
    """构建单属性字段配置。"""
    return {"selector": selector, "attr": attr, "multiple": False}


def _attr_list(selector: str, attr: str) -> dict[str, Any]:
    """构建多属性字段配置。"""
    return {"selector": selector, "attr": attr, "multiple": True}


# ---------------------------------------------------------------------------
# 领域配置模板
# ---------------------------------------------------------------------------

# 电商产品提取
ECOMMERCE_CONFIG = {
    "product_name": _text(
        "h1.product-title, .product-name h1, [data-testid='product-name']"
    ),
    "price": _text(".price, .product-price, [data-testid='price']"),
    "description": _text(
        ".product-description, .description, [data-testid='description']"
    ),
    "images": _attr_list(".product-image img, .gallery img", "src"),
    "availability": _text(".availability, .stock-status, [data-testid='availability']"),
    "rating": _text(".rating, .stars, [data-testid='rating']"),
    "specifications": _text_list(".specifications li, .specs .spec-item"),
}

# 新闻文章提取
NEWS_ARTICLE_CONFIG = {
    "headline": _text("h1, .headline, .article-title"),
    "author": _text(".author, .byline, [rel='author']"),
    "publish_date": _attr("time, .date, .published-date", "datetime"),
    "article_body": _text_list(".article-body p, .content p, .post-content p"),
    "tags": _text_list(".tags a, .categories a"),
    "featured_image": _attr(".featured-image img, .article-image img", "src"),
}

# 社交媒体资料提取
SOCIAL_PROFILE_CONFIG = {
    "username": _text(".username, .handle, .profile-username"),
    "display_name": _text(".display-name, .profile-name, h1"),
    "bio": _text(".bio, .description, .profile-description"),
    "follower_count": _text(".followers-count, .follower-stats"),
    "following_count": _text(".following-count, .following-stats"),
    "posts": _text_list(".post, .tweet, .update"),
    "profile_image": _attr(".profile-image img, .avatar img", "src"),
}

# 职位列表提取
JOB_LISTING_CONFIG = {
    "job_title": _text("h1, .job-title, .position-title"),
    "company_name": _text(".company-name, .employer, .company"),
    "location": _text(".location, .job-location"),
    "salary": _text(".salary, .pay, .compensation"),
    "job_type": _text(".job-type, .employment-type"),
    "description": _text(".job-description, .description"),
    "requirements": _text_list(".requirements li, .qualifications li"),
    "benefits": _text_list(".benefits li, .perks li"),
    "posted_date": _text(".posted-date, .job-date, time"),
}

# 房产列表提取
REAL_ESTATE_CONFIG = {
    "property_title": _text("h1, .property-title, .listing-title"),
    "price": _text(".price, .property-price, .listing-price"),
    "address": _text(".address, .property-address, .location"),
    "bedrooms": _text(".bedrooms, .beds, [data-testid='bedrooms']"),
    "bathrooms": _text(".bathrooms, .baths, [data-testid='bathrooms']"),
    "square_footage": _text(".square-feet, .sqft, .area"),
    "description": _text(".property-description, .listing-description"),
    "features": _text_list(".features li, .amenities li"),
    "images": _attr_list(".property-images img, .listing-photos img", "src"),
    "agent_info": _text(".agent-name, .realtor-name"),
}

# 餐厅菜单提取
RESTAURANT_MENU_CONFIG = {
    "restaurant_name": _text("h1, .restaurant-name, .business-name"),
    "menu_categories": _text_list(".menu-category, .category-title"),
    "menu_items": _attr_list(".menu-item", "outerHTML"),
    "item_names": _text_list(".item-name, .dish-name"),
    "item_prices": _text_list(".item-price, .price"),
    "item_descriptions": _text_list(".item-description, .dish-description"),
    "contact_info": _text_list(".contact, .phone, .address"),
}

# 学术论文提取
ACADEMIC_PAPER_CONFIG = {
    "title": _text("h1, .article-title, .paper-title"),
    "authors": _text_list(".authors .author, .author-list .author"),
    "abstract": _text(".abstract, .summary"),
    "keywords": _text_list(".keywords .keyword, .tags .tag"),
    "publication_date": _text(".pub-date, .published, time"),
    "journal": _text(".journal, .publication"),
    "doi": _text(".doi, [data-doi]"),
    "citations": _text(".citation-count, .citations"),
    "references": _text_list(".references li, .bibliography li"),
}

# 论坛讨论提取
FORUM_POST_CONFIG = {
    "thread_title": _text("h1, .thread-title, .topic-title"),
    "original_post": _text(".original-post .content, .first-post .message"),
    "post_author": _text(".post-author, .username, .user-name"),
    "post_date": _text(".post-date, .timestamp, time"),
    "replies": _text_list(".reply .content, .post .message"),
    "reply_authors": _text_list(".reply .author, .post .username"),
    "vote_count": _text(".votes, .score, .points"),
    "tags": _text_list(".tags .tag, .categories .category"),
}

# 事件列表提取
EVENT_LISTING_CONFIG = {
    "event_name": _text("h1, .event-title, .event-name"),
    "event_date": _text(".event-date, .date, time"),
    "event_time": _text(".event-time, .time"),
    "venue": _text(".venue, .location, .event-location"),
    "address": _text(".address, .venue-address"),
    "description": _text(".event-description, .description"),
    "ticket_price": _text(".ticket-price, .price"),
    "organizer": _text(".organizer, .event-organizer"),
    "categories": _text_list(".categories .category, .tags .tag"),
}

# 联系页面提取
CONTACT_PAGE_CONFIG = {
    "company_name": _text("h1, .company-name, .business-name"),
    "phone_numbers": _text_list(".phone, .tel, [href^='tel:']"),
    "email_addresses": _attr_list(".email, [href^='mailto:']", "href"),
    "physical_address": _text(".address, .location, .contact-address"),
    "business_hours": _text(".hours, .opening-hours, .business-hours"),
    "social_media": _attr_list(".social-links a, .social-media a", "href"),
    "contact_form": _attr("form", "outerHTML"),
}

# ---------------------------------------------------------------------------
# 配置注册表与辅助函数
# ---------------------------------------------------------------------------

EXTRACTION_CONFIGS = {
    "ecommerce": ECOMMERCE_CONFIG,
    "news": NEWS_ARTICLE_CONFIG,
    "social": SOCIAL_PROFILE_CONFIG,
    "jobs": JOB_LISTING_CONFIG,
    "realestate": REAL_ESTATE_CONFIG,
    "restaurant": RESTAURANT_MENU_CONFIG,
    "academic": ACADEMIC_PAPER_CONFIG,
    "forum": FORUM_POST_CONFIG,
    "events": EVENT_LISTING_CONFIG,
    "contact": CONTACT_PAGE_CONFIG,
}


def get_config_for_site_type(site_type: str):
    """按类型名称获取提取配置（不区分大小写）。"""
    return EXTRACTION_CONFIGS.get(site_type.lower())


def print_all_configs():
    """打印所有可用配置。"""
    print("Available extraction configurations:")
    print("=" * 50)

    for name, config in EXTRACTION_CONFIGS.items():
        print(f"\n{name.upper()} CONFIG:")
        print("-" * 20)

        for field, settings in config.items():
            if isinstance(settings, dict):
                print(
                    f"  {field}: {settings['selector']} ({settings.get('attr', 'text')})"
                )
            else:
                print(f"  {field}: {settings}")


if __name__ == "__main__":
    print_all_configs()
