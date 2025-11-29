import config
from document_store import DocumentStore

def main():
    # 检查环境变量是否已设置
    if not config.API_KEY:
        print("请设置 EMBEDDING_API_KEY 环境变量！")
        print("示例: export EMBEDDING_API_KEY=your_api_key_here")
        return

    print("正在初始化文档存储...")
    store = DocumentStore()

    # 示例数据 (中文)
    documents = [
        {
            "content": "敏捷的棕色狐狸跳过了懒惰的狗。",
            "metadata": {"category": "动物", "source": "寓言"}
        },
        {
            "content": "人工智能正在改变世界，深度学习是其中的核心技术。",
            "metadata": {"category": "科技", "source": "新闻"}
        },
        {
            "content": "Python 是数据科学和机器学习领域最受欢迎的编程语言。",
            "metadata": {"category": "科技", "source": "教程"}
        },
        {
            "content": "均衡的饮食和规律的运动对保持身体健康至关重要。",
            "metadata": {"category": "健康", "source": "指南"}
        },
        {
            "content": "故宫是中国明清两代的皇家宫殿，旧称紫禁城。",
            "metadata": {"category": "历史", "source": "百科"}
        },
        {
            "content": "量子计算利用量子力学原理，能够解决传统计算机无法处理的复杂问题。",
            "metadata": {"category": "科技", "source": "前沿"}
        },
        # 城市特色数据
        {
            "content": "成都：以火锅、大熊猫和悠闲的生活节奏闻名，是著名的美食之都。",
            "metadata": {"category": "旅游", "source": "城市指南"}
        },
        {
            "content": "西安：十三朝古都，拥有兵马俑、大雁塔等丰富的历史文化遗产。",
            "metadata": {"category": "旅游", "source": "城市指南"}
        },
        {
            "content": "上海：现代化国际大都市，外滩的万国建筑群与陆家嘴的摩天大楼交相辉映。",
            "metadata": {"category": "旅游", "source": "城市指南"}
        },
        {
            "content": "三亚：拥有美丽的热带海滩、阳光和椰林，是著名的度假胜地。",
            "metadata": {"category": "旅游", "source": "城市指南"}
        }
    ]

    print(f"\n正在添加 {len(documents)} 个文档...")
    user_id = 1  # 示例用户 ID
    for doc in documents:
        try:
            doc_id = store.add_document(user_id, doc["content"], doc["metadata"])
            print(f"已添加文档 ID: {doc_id}")
        except Exception as e:
            print(f"添加文档出错: {e}")

    # 搜索示例
    queries = [
        "编程工具与语言",
        "如何保持健康饮食",
        "关于狐狸的故事",
        "中国古代建筑",
        "未来计算技术",
        "我想去吃辣看熊猫",
        "适合看海度假的地方",
        "感受历史文化的古都"
    ]

    # 模拟用户设置的相似度阈值 (0.8 表示 80% 相似)
    similarity_threshold = 0.8
    # 转换为距离阈值 (距离越小越相似)
    distance_threshold = 1.0 - similarity_threshold
    
    print(f"\n正在执行搜索 (相似度阈值: {similarity_threshold}, 距离阈值: {distance_threshold:.2f})...")
    for query in queries:
        print(f"\n查询: '{query}'")
        # 注意：search 返回 (results, total) 元组
        results, total = store.search(user_id, query, threshold=distance_threshold, limit=2)
        
        if not results:
            print("   未找到相关文档 (距离过远)")
            continue

        for i, result in enumerate(results, 1):
            print(f"{i}. 内容: {result['content']}")
            print(f"   距离: {result['distance']:.4f}")
            print(f"   元数据: {result['metadata']}")

    store.close()

if __name__ == "__main__":
    main()