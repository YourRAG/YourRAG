#!/usr/bin/env python3
"""
MCP (Model Context Protocol) 客户端模块
用于与 MCP 服务器进行交互，支持工具调用和资源访问
"""

import os
import requests
import json
from typing import Optional, Dict, Any, List

# MCP Client version
MCP_CLIENT_VERSION = "1.0.0"


class MCPClient:
    """MCP 客户端类，用于与 MCP 服务器进行交互"""

    def __init__(
        self,
        server_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: int = 60,
    ):
        """
        初始化 MCP 客户端

        Args:
            server_url: MCP 服务器 URL（默认使用 Exa MCP 服务器）
            api_key: API 密钥（某些服务器需要）
            timeout: 请求超时时间（秒，默认 60）
        """
        self.server_url = server_url or os.getenv(
            "MCP_SERVER_URL", "https://mcp.exa.ai/mcp"
        )
        self.api_key = api_key or os.getenv("MCP_API_KEY")
        self.timeout = timeout
        self.request_id = 0

        # 构建请求头
        # MCP 服务器要求同时接受 application/json 和 text/event-stream
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }

        if self.api_key:
            self.headers["Authorization"] = f"Bearer {self.api_key}"

    def _get_next_request_id(self) -> int:
        """
        获取下一个请求 ID

        Returns:
            请求 ID
        """
        self.request_id += 1
        return self.request_id

    def _make_request(
        self, method: str, params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        发送 JSON-RPC 2.0 请求

        Args:
            method: 方法名称
            params: 方法参数

        Returns:
            响应结果

        Raises:
            RuntimeError: 请求失败时抛出
        """
        payload = {
            "jsonrpc": "2.0",
            "id": self._get_next_request_id(),
            "method": method,
        }

        if params is not None:
            payload["params"] = params

        try:
            response = requests.post(
                self.server_url,
                headers=self.headers,
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            
            # 强制使用 UTF-8 编码，避免中文乱码
            response.encoding = 'utf-8'

            # 处理 SSE 格式的响应
            content_type = response.headers.get("Content-Type", "")

            if "text/event-stream" in content_type:
                # 解析 SSE 格式
                result = self._parse_sse_response(response.text)
            else:
                # 普通 JSON 响应
                result = response.json()

            # 检查 JSON-RPC 错误
            if "error" in result:
                error = result["error"]
                raise RuntimeError(
                    f"MCP 错误 [{error.get('code', 'unknown')}]: {error.get('message', 'Unknown error')}"
                )

            return result.get("result", {})

        except requests.exceptions.Timeout:
            raise RuntimeError(f"请求超时（{self.timeout}秒）")
        except requests.exceptions.ConnectionError:
            raise RuntimeError(f"无法连接到 MCP 服务器: {self.server_url}")
        except requests.exceptions.HTTPError as e:
            raise RuntimeError(
                f"HTTP 错误: {e.response.status_code} - {e.response.text}"
            )
        except json.JSONDecodeError as e:
            raise RuntimeError(f"响应不是有效的 JSON 格式: {str(e)}")
        except Exception as e:
            raise RuntimeError(f"MCP 请求失败: {str(e)}")

    def _parse_sse_response(self, sse_text: str) -> Dict[str, Any]:
        """
        解析 SSE 格式的响应

        Args:
            sse_text: SSE 格式的文本

        Returns:
            解析后的 JSON 对象
        """
        # SSE 格式: data: {json}\n\n
        lines = sse_text.strip().split("\n")

        for line in lines:
            line = line.strip()
            if line.startswith("data: "):
                data_str = line[6:]  # 移除 'data: ' 前缀
                try:
                    return json.loads(data_str)
                except json.JSONDecodeError:
                    continue

        raise RuntimeError("未能从 SSE 响应中提取有效的 JSON 数据")

    def initialize(self) -> Dict[str, Any]:
        """
        初始化 MCP 会话

        Returns:
            服务器信息和能力
        """
        params = {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "ails-mcp-client", "version": MCP_CLIENT_VERSION},
        }
        return self._make_request("initialize", params)

    def list_tools(self) -> List[Dict[str, Any]]:
        """
        列出服务器提供的所有工具

        Returns:
            工具列表，每个工具包含名称、描述和输入模式
        """
        result = self._make_request("tools/list")
        return result.get("tools", [])

    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """
        调用指定的工具

        Args:
            tool_name: 工具名称
            arguments: 工具参数

        Returns:
            工具执行结果
        """
        params = {"name": tool_name, "arguments": arguments}
        result = self._make_request("tools/call", params)
        return result.get("content", [])

    def list_resources(self) -> List[Dict[str, Any]]:
        """
        列出服务器提供的所有资源

        Returns:
            资源列表
        """
        result = self._make_request("resources/list")
        return result.get("resources", [])

    def read_resource(self, uri: str) -> Any:
        """
        读取指定的资源

        Args:
            uri: 资源 URI

        Returns:
            资源内容
        """
        params = {"uri": uri}
        result = self._make_request("resources/read", params)
        return result.get("contents", [])

    def search_with_exa(
        self,
        query: str,
        num_results: int = 8,
        livecrawl: str = "fallback",
        search_type: str = "auto",
        context_max_characters: int = 10000,
    ) -> List[Dict[str, Any]]:
        """
        使用 Exa 进行网络搜索（便捷方法）

        Args:
            query: 搜索查询
            num_results: 返回结果数量（默认 8）
            livecrawl: 实时抓取模式 - 'fallback' 或 'preferred'（默认 'fallback'）
            search_type: 搜索类型 - 'auto', 'fast', 或 'deep'（默认 'auto'）
            context_max_characters: 上下文最大字符数（默认 10000）

        Returns:
            搜索结果列表
        """
        arguments = {
            "query": query,
            "numResults": num_results,
            "livecrawl": livecrawl,
            "type": search_type,
            "contextMaxCharacters": context_max_characters,
        }
        return self.call_tool("web_search_exa", arguments)

    def crawl_url_with_exa(
        self, url: str, max_characters: int = 3000
    ) -> List[Dict[str, Any]]:
        """
        使用 Exa 抓取指定 URL 的内容（便捷方法）

        Args:
            url: 要抓取的 URL
            max_characters: 最大字符数（默认 3000）

        Returns:
            抓取的内容
        """
        arguments = {"url": url, "maxCharacters": max_characters}
        return self.call_tool("crawling_exa", arguments)

    def get_code_context_with_exa(
        self, query: str, tokens_num: int = 5000
    ) -> List[Dict[str, Any]]:
        """
        使用 Exa 获取编程相关的上下文（便捷方法）

        Args:
            query: 搜索查询（例如 'React useState hook examples'）
            tokens_num: 返回的 token 数量（1000-50000，默认 5000）

        Returns:
            相关的代码上下文
        """
        arguments = {"query": query, "tokensNum": tokens_num}
        return self.call_tool("get_code_context_exa", arguments)


def create_mcp_client(
    server_url: Optional[str] = None, api_key: Optional[str] = None
) -> MCPClient:
    """
    创建 MCP 客户端实例的便捷函数

    Args:
        server_url: MCP 服务器 URL
        api_key: API 密钥

    Returns:
        MCPClient 实例
    """
    return MCPClient(server_url=server_url, api_key=api_key)


if __name__ == "__main__":
    # 示例用法
    print("MCP 客户端示例")
    print("=" * 50)

    try:
        # 创建客户端
        client = create_mcp_client()
        print(f"连接到服务器: {client.server_url}\n")

        # 初始化会话
        print("初始化 MCP 会话...")
        init_result = client.initialize()
        print(
            f"服务器信息: {init_result.get('serverInfo', {}).get('name', 'Unknown')}\n"
        )

        # 列出可用工具
        print("可用工具:")
        tools = client.list_tools()
        for tool in tools:
            print(
                f"  - {tool.get('name')}: {tool.get('description', 'No description')}"
            )
        print()

        # 测试搜索功能
        print("\n测试 Exa 搜索...")
        print("正在搜索: '这个库有什么已知的漏洞")

        search_results = client.search_with_exa(
            query="这个cython库有什么已知的漏洞", num_results=2, search_type="fast"
        )

        print(f"\n找到 {len(search_results)} 个结果:")
        for i, result in enumerate[Dict[str, Any]](search_results, 1):
            if isinstance(result, dict):
                text = result.get("text", "")
                print(f"\n--- 结果 {i} ---")
                # 只显示前 300 个字符
                preview = text[:300] + "..." if len(text) > 300 else text
                print(preview)

        print("\n✅ MCP 客户端测试成功！")

    except Exception as e:
        print(f"错误: {e}")
