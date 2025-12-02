"""用户活动追踪服务"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from prisma import Prisma
from prisma import Json
from enum import Enum
from config_service import config_service


class ActivityType(str, Enum):
    """活动类型枚举"""
    DOCUMENT_ADD = "DOCUMENT_ADD"
    DOCUMENT_UPDATE = "DOCUMENT_UPDATE"
    DOCUMENT_DELETE = "DOCUMENT_DELETE"
    SEARCH = "SEARCH"
    RAG_QUERY = "RAG_QUERY"
    LOGIN = "LOGIN"
    SYSTEM = "SYSTEM"


class ActivityService:
    """用户活动服务类"""
    
    def __init__(self, prisma: Prisma):
        self.prisma = prisma
    
    async def record_activity(
        self,
        user_id: int,
        activity_type: ActivityType,
        title: str,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        记录用户活动
        
        Args:
            user_id: 用户ID
            activity_type: 活动类型
            title: 活动标题
            description: 活动描述
            metadata: 额外元数据
        """
        # Check if activity tracking is enabled
        if not config_service.is_activity_tracking_enabled():
            return
            
        try:
            create_data: Dict[str, Any] = {
                "user": {"connect": {"id": user_id}},
                "type": activity_type.value,
                "title": title,
                "description": description,
            }
            
            # Only set metadata if it has a value (Prisma Json field handling)
            if metadata is not None:
                create_data["metadata"] = Json(metadata)
            
            await self.prisma.activity.create(data=create_data)
        except Exception as e:
            # 记录活动失败不应影响主要业务逻辑
            print(f"Failed to record activity: {e}")
            import traceback
            traceback.print_exc()
    
    async def get_user_activities(
        self,
        user_id: int,
        limit: int = 10,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        获取用户活动列表
        
        Args:
            user_id: 用户ID
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            活动列表
        """
        activities = await self.prisma.activity.find_many(
            where={"userId": user_id},
            order={"createdAt": "desc"},
            take=limit,
            skip=offset
        )
        
        return [
            {
                "id": activity.id,
                "type": activity.type,
                "title": activity.title,
                "description": activity.description,
                "metadata": activity.metadata,
                "createdAt": activity.createdAt.isoformat()
            }
            for activity in activities
        ]
    
    async def get_activity_count(self, user_id: int) -> int:
        """
        获取用户活动总数
        
        Args:
            user_id: 用户ID
            
        Returns:
            活动总数
        """
        return await self.prisma.activity.count(
            where={"userId": user_id}
        )
    
    async def get_user_stats(self, user_id: int) -> Dict[str, Any]:
        """
        获取用户统计数据
        
        Args:
            user_id: 用户ID
            
        Returns:
            统计数据字典
        """
        # 获取各类活动的数量
        document_add_count = await self.prisma.activity.count(
            where={
                "userId": user_id,
                "type": ActivityType.DOCUMENT_ADD.value
            }
        )
        
        search_count = await self.prisma.activity.count(
            where={
                "userId": user_id,
                "type": ActivityType.SEARCH.value
            }
        )
        
        rag_query_count = await self.prisma.activity.count(
            where={
                "userId": user_id,
                "type": ActivityType.RAG_QUERY.value
            }
        )
        
        total_activities = await self.prisma.activity.count(
            where={"userId": user_id}
        )
        
        return {
            "documentCount": document_add_count,
            "searchCount": search_count,
            "queryCount": rag_query_count,
            "totalActivities": total_activities
        }

    async def clear_user_activities(self, user_id: int) -> int:
        """
        清空用户的所有活动记录
        
        Args:
            user_id: 用户ID
            
        Returns:
            删除的记录数量
        """
        result = await self.prisma.activity.delete_many(
            where={"userId": user_id}
        )
        return result


# 辅助函数，用于快速记录活动
async def record_document_add(
    prisma: Prisma,
    user_id: int,
    doc_id: int,
    doc_title: Optional[str] = None
) -> None:
    """记录添加文档活动"""
    service = ActivityService(prisma)
    await service.record_activity(
        user_id=user_id,
        activity_type=ActivityType.DOCUMENT_ADD,
        title="Added a new document",
        description=f"Document ID: {doc_id}" + (f", Title: {doc_title}" if doc_title else ""),
        metadata={"documentId": doc_id, "documentTitle": doc_title}
    )


async def record_search(
    prisma: Prisma,
    user_id: int,
    query: str,
    result_count: int
) -> None:
    """记录搜索活动"""
    service = ActivityService(prisma)
    await service.record_activity(
        user_id=user_id,
        activity_type=ActivityType.SEARCH,
        title="Performed a search",
        description=f"Searched for: \"{query}\" ({result_count} results)",
        metadata={"query": query, "resultCount": result_count}
    )


async def record_rag_query(
    prisma: Prisma,
    user_id: int,
    query: str
) -> None:
    """记录 RAG 问答活动"""
    service = ActivityService(prisma)
    await service.record_activity(
        user_id=user_id,
        activity_type=ActivityType.RAG_QUERY,
        title="Asked a question",
        description=f"Query: \"{query[:100]}{'...' if len(query) > 100 else ''}\"",
        metadata={"query": query}
    )


async def record_login(
    prisma: Prisma,
    user_id: int
) -> None:
    """记录登录活动"""
    service = ActivityService(prisma)
    await service.record_activity(
        user_id=user_id,
        activity_type=ActivityType.LOGIN,
        title="Logged in",
        description="Successfully authenticated via GitHub"
    )


async def record_document_delete(
    prisma: Prisma,
    user_id: int,
    doc_id: int
) -> None:
    """记录删除文档活动"""
    service = ActivityService(prisma)
    await service.record_activity(
        user_id=user_id,
        activity_type=ActivityType.DOCUMENT_DELETE,
        title="Deleted a document",
        description=f"Document ID: {doc_id}",
        metadata={"documentId": doc_id}
    )


async def record_settings_update(
    prisma: Prisma,
    user_id: int,
    details: str
) -> None:
    """记录设置更新活动"""
    service = ActivityService(prisma)
    await service.record_activity(
        user_id=user_id,
        activity_type=ActivityType.SYSTEM,
        title="Updated settings",
        description=details
    )