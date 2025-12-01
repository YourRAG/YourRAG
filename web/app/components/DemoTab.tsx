"use client";

import { useState, useRef, useEffect } from "react";
import {
  Loader2,
  FileText,
  Search,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  Play,
  Copy,
  Key,
  Sparkles,
  ArrowRight,
  Bot,
  User,
  Edit,
  Trash2,
  FolderMinus,
  List,
  FileSearch,
  Database,
  BarChart3,
  FolderPlus,
  FolderEdit,
  ArrowRightLeft,
} from "lucide-react";
import Markdown from "./Markdown";
import { AlertModal } from "./Modal";
import AdvancedApiDemo from "./AdvancedApiDemo";

interface StepStatus {
  completed: boolean;
  loading: boolean;
  result?: unknown;
  error?: string;
}

interface SearchResultItem {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  distance: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function DemoTab() {
  const [origin, setOrigin] = useState("");
  
  // API Key state
  const [apiKeys, setApiKeys] = useState<{ id: number; key: string; name: string }[]>([]);
  const [selectedApiKey, setSelectedApiKey] = useState<string>("");
  const [loadingKeys, setLoadingKeys] = useState(false);
  
  // Step 1: Add Document
  const [documentContent, setDocumentContent] = useState(
    "Artificial Intelligence (AI) is transforming the way we interact with technology. Machine Learning, a subset of AI, enables computers to learn from data without being explicitly programmed. Deep Learning, using neural networks with many layers, has achieved remarkable results in image recognition, natural language processing, and more."
  );
  const [documentGroupName, setDocumentGroupName] = useState("AI Knowledge");
  const [documentCategory, setDocumentCategory] = useState("technology");
  const [documentSource, setDocumentSource] = useState("demo");
  const [step1Status, setStep1Status] = useState<StepStatus>({ completed: false, loading: false });
  
  // Step 2: Search
  const [searchQuery, setSearchQuery] = useState("What is machine learning?");
  const [searchGroupName, setSearchGroupName] = useState("");
  const [step2Status, setStep2Status] = useState<StepStatus>({ completed: false, loading: false });
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  
  // Step 3: Chat
  const [chatQuery, setChatQuery] = useState("Explain AI in simple terms");
  const [chatGroupName, setChatGroupName] = useState("");
  const [models, setModels] = useState<{ id: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [step3Status, setStep3Status] = useState<StepStatus>({ completed: false, loading: false });
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Step 4: Update Document
  const [updateDocId, setUpdateDocId] = useState("");
  const [updateContent, setUpdateContent] = useState("Updated: AI and ML are rapidly evolving fields that continue to transform industries worldwide.");
  const [updateMetadata, setUpdateMetadata] = useState('{"category": "updated-tech", "version": "2.0"}');
  const [step4Status, setStep4Status] = useState<StepStatus>({ completed: false, loading: false });
  
  // Step 5: Delete Document
  const [deleteDocId, setDeleteDocId] = useState("");
  const [step5Status, setStep5Status] = useState<StepStatus>({ completed: false, loading: false });
  
  // Step 6: List Groups
  const [step6Status, setStep6Status] = useState<StepStatus>({ completed: false, loading: false });
  const [groupsList, setGroupsList] = useState<{ id: number; name: string; documentCount: number }[]>([]);
  
  // Step 7: List Documents in Group
  const [listDocsGroupName, setListDocsGroupName] = useState("");
  const [step7Status, setStep7Status] = useState<StepStatus>({ completed: false, loading: false });
  const [groupDocsList, setGroupDocsList] = useState<{ id: number; content: string; metadata: Record<string, unknown> }[]>([]);
  
  // Step 8: Get Document with Vector
  const [getDocGroupName, setGetDocGroupName] = useState("");
  const [getDocId, setGetDocId] = useState("");
  const [step8Status, setStep8Status] = useState<StepStatus>({ completed: false, loading: false });
  const [documentWithVector, setDocumentWithVector] = useState<{ id: number; content: string; embedding?: number[] } | null>(null);
  
  // Step 9: Get Stats
  const [step9Status, setStep9Status] = useState<StepStatus>({ completed: false, loading: false });
  const [statsData, setStatsData] = useState<{ totalDocuments: number; totalGroups: number } | null>(null);
  
  // Step 10: Create Group
  const [newGroupName, setNewGroupName] = useState("My New Group");
  const [step10Status, setStep10Status] = useState<StepStatus>({ completed: false, loading: false });
  
  // Step 11: Rename Group
  const [renameGroupOldName, setRenameGroupOldName] = useState("");
  const [renameGroupNewName, setRenameGroupNewName] = useState("");
  const [step11Status, setStep11Status] = useState<StepStatus>({ completed: false, loading: false });
  
  // Step 12: Move Document
  const [moveDocId, setMoveDocId] = useState("");
  const [moveTargetGroupName, setMoveTargetGroupName] = useState("");
  const [step12Status, setStep12Status] = useState<StepStatus>({ completed: false, loading: false });
  
  // Step 13: Delete Group
  const [deleteGroupId, setDeleteGroupId] = useState("");
  const [deleteGroupName, setDeleteGroupName] = useState("");
  const [deleteByName, setDeleteByName] = useState(false);
  const [deleteGroupWithDocs, setDeleteGroupWithDocs] = useState(true);
  const [step13Status, setStep13Status] = useState<StepStatus>({ completed: false, loading: false });
  
  const [showAuthAlert, setShowAuthAlert] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    
    const fetchApiKeys = async () => {
      setLoadingKeys(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/user/apikeys`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setApiKeys(data);
          if (data.length > 0) {
            setSelectedApiKey(data[0].key);
          }
        }
      } catch (e) {
        console.error("Failed to fetch API keys", e);
      } finally {
        setLoadingKeys(false);
      }
    };

    const fetchModels = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/v1/models`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setModels(data.data || []);
          if (data.data && data.data.length > 0) {
            setSelectedModel(data.data[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to fetch models", e);
      }
    };

    fetchApiKeys();
    fetchModels();
  }, []);

  // Compute effective model with group suffix
  const effectiveModel = chatGroupName.trim()
    ? `${selectedModel}-${chatGroupName.trim()}`
    : selectedModel;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Step 1: Add Document
  const handleAddDocument = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    
    setStep1Status({ completed: false, loading: true });
    
    try {
      // Build metadata object
      const metadata: Record<string, string> = {};
      if (documentGroupName.trim()) metadata.groupName = documentGroupName.trim();
      if (documentCategory.trim()) metadata.category = documentCategory.trim();
      if (documentSource.trim()) metadata.source = documentSource.trim();
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selectedApiKey}`,
        },
        body: JSON.stringify({
          content: documentContent,
          metadata: metadata,
        }),
      });
      
      if (!res.ok) throw new Error("Failed to add document");
      
      const data = await res.json();
      setStep1Status({ completed: true, loading: false, result: data });
      
      // Auto-fill document ID for update/delete steps
      if (data.id) {
        setUpdateDocId(String(data.id));
        setDeleteDocId(String(data.id));
      }
      // Auto-fill group ID for delete group step
      if (data.groupId) {
        setDeleteGroupId(String(data.groupId));
      }
    } catch (error) {
      setStep1Status({
        completed: false,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Step 2: Search Documents
  const handleSearch = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    
    setStep2Status({ completed: false, loading: true });
    setSearchResults([]);
    
    try {
      let searchUrl = `${process.env.NEXT_PUBLIC_API_URL || ""}/search?query=${encodeURIComponent(searchQuery)}`;
      if (searchGroupName.trim()) {
        searchUrl += `&group_name=${encodeURIComponent(searchGroupName.trim())}`;
      }
      
      const res = await fetch(searchUrl, {
        headers: {
          "Authorization": `Bearer ${selectedApiKey}`,
        },
      });
      
      if (!res.ok) throw new Error("Search failed");
      
      const data = await res.json();
      setSearchResults(data.results || []);
      setStep2Status({ completed: true, loading: false, result: data });
    } catch (error) {
      setStep2Status({ 
        completed: false, 
        loading: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  };

  // Step 3: Chat Completion
  const handleChat = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    
    const userMessage: Message = { role: "user", content: chatQuery };
    setMessages([userMessage]);
    setStep3Status({ completed: false, loading: true });
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selectedApiKey}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: chatQuery }],
          model: effectiveModel || undefined,
          stream: true,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });
      
      if (!res.ok) throw new Error("Chat request failed");
      
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader available");
      
      const decoder = new TextDecoder();
      let assistantContent = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") break;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.choices?.[0]?.delta?.content) {
                assistantContent += data.choices[0].delta.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { role: "assistant", content: assistantContent };
                  return newMessages;
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
      
      setStep3Status({ completed: true, loading: false });
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      setStep3Status({ 
        completed: false, 
        loading: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  };

  // Step 4: Update Document
  const handleUpdateDocument = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    if (!updateDocId.trim()) return;
    
    setStep4Status({ completed: false, loading: true });
    
    try {
      let metadata = {};
      try {
        metadata = JSON.parse(updateMetadata);
      } catch {
        // Invalid JSON, use empty object
      }
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/documents/${updateDocId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selectedApiKey}`,
        },
        body: JSON.stringify({
          content: updateContent || undefined,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to update document");
      }
      
      const data = await res.json();
      setStep4Status({ completed: true, loading: false, result: data });
    } catch (error) {
      setStep4Status({
        completed: false,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Step 5: Delete Document
  const handleDeleteDocument = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    if (!deleteDocId.trim()) return;
    
    setStep5Status({ completed: false, loading: true });
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/documents/${deleteDocId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${selectedApiKey}`,
        },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to delete document");
      }
      
      const data = await res.json();
      setStep5Status({ completed: true, loading: false, result: data });
    } catch (error) {
      setStep5Status({
        completed: false,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Step 6: List Groups
  const handleListGroups = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    
    setStep6Status({ completed: false, loading: true });
    setGroupsList([]);
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/groups`, {
        headers: {
          "Authorization": `Bearer ${selectedApiKey}`,
        },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to list groups");
      }
      
      const data = await res.json();
      setGroupsList(data);
      setStep6Status({ completed: true, loading: false, result: data });
      
      // Auto-fill first group for subsequent steps
      if (data.length > 0) {
        setDeleteGroupId(String(data[0].id));
        setDeleteGroupName(data[0].name);
        setListDocsGroupName(data[0].name);
        setGetDocGroupName(data[0].name);
      }
    } catch (error) {
      setStep6Status({
        completed: false,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Step 7: List Documents in Group
  const handleListDocsInGroup = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    if (!listDocsGroupName.trim()) return;
    
    setStep7Status({ completed: false, loading: true });
    setGroupDocsList([]);
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/groups/by-name/${encodeURIComponent(listDocsGroupName)}/documents`, {
        headers: {
          "Authorization": `Bearer ${selectedApiKey}`,
        },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to list documents");
      }
      
      const data = await res.json();
      setGroupDocsList(data.documents || []);
      setStep7Status({ completed: true, loading: false, result: data });
      
      // Auto-fill first document ID for Step 8
      if (data.documents && data.documents.length > 0) {
        setGetDocId(String(data.documents[0].id));
        setGetDocGroupName(listDocsGroupName);
      }
    } catch (error) {
      setStep7Status({
        completed: false,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Step 8: Get Document with Vector
  const handleGetDocWithVector = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    if (!getDocGroupName.trim() || !getDocId.trim()) return;
    
    setStep8Status({ completed: false, loading: true });
    setDocumentWithVector(null);
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/groups/by-name/${encodeURIComponent(getDocGroupName)}/documents/${getDocId}?include_vector=true`, {
        headers: {
          "Authorization": `Bearer ${selectedApiKey}`,
        },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to get document");
      }
      
      const data = await res.json();
      setDocumentWithVector(data);
      setStep8Status({ completed: true, loading: false, result: data });
    } catch (error) {
      setStep8Status({
        completed: false,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Step 9: Get Stats
  const handleGetStats = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    
    setStep9Status({ completed: false, loading: true });
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/stats`, {
        headers: {
          "Authorization": `Bearer ${selectedApiKey}`,
        },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to get stats");
      }
      
      const data = await res.json();
      setStatsData(data);
      setStep9Status({ completed: true, loading: false, result: data });
    } catch (error) {
      setStep9Status({
        completed: false,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Step 10: Create Group
  const handleCreateGroup = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    if (!newGroupName.trim()) return;
    
    setStep10Status({ completed: false, loading: true });
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selectedApiKey}`,
        },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to create group");
      }
      
      const data = await res.json();
      setStep10Status({ completed: true, loading: false, result: data });
      
      // Auto-fill for rename step
      setRenameGroupOldName(newGroupName.trim());
    } catch (error) {
      setStep10Status({
        completed: false,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Step 11: Rename Group
  const handleRenameGroup = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    if (!renameGroupOldName.trim() || !renameGroupNewName.trim()) return;
    
    setStep11Status({ completed: false, loading: true });
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/groups/by-name/${encodeURIComponent(renameGroupOldName)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selectedApiKey}`,
        },
        body: JSON.stringify({ name: renameGroupNewName.trim() }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to rename group");
      }
      
      const data = await res.json();
      setStep11Status({ completed: true, loading: false, result: data });
    } catch (error) {
      setStep11Status({
        completed: false,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Step 12: Move Document
  const handleMoveDocument = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    if (!moveDocId.trim()) return;
    
    setStep12Status({ completed: false, loading: true });
    
    try {
      const body: { group_name?: string; group_id?: null } = {};
      if (moveTargetGroupName.trim()) {
        body.group_name = moveTargetGroupName.trim();
      } else {
        body.group_id = null; // Ungroup
      }
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/documents/${moveDocId}/move`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selectedApiKey}`,
        },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to move document");
      }
      
      const data = await res.json();
      setStep12Status({ completed: true, loading: false, result: data });
    } catch (error) {
      setStep12Status({
        completed: false,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Step 13: Delete Group
  const handleDeleteGroup = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    if (deleteByName && !deleteGroupName.trim()) return;
    if (!deleteByName && !deleteGroupId.trim()) return;
    
    setStep13Status({ completed: false, loading: true });
    
    try {
      const endpoint = deleteByName
        ? `/api/groups/by-name/${encodeURIComponent(deleteGroupName)}?delete_documents=${deleteGroupWithDocs}`
        : `/api/groups/${deleteGroupId}?delete_documents=${deleteGroupWithDocs}`;
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}${endpoint}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${selectedApiKey}`,
        },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to delete group");
      }
      
      const data = await res.json();
      setStep13Status({ completed: true, loading: false, result: data });
    } catch (error) {
      setStep13Status({
        completed: false,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const curlStats = `curl -X GET "${origin}/api/stats" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}"`;

  const curlCreateGroup = `curl -X POST "${origin}/api/groups" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}" \\
  -d '{"name": "${newGroupName}"}'`;

  const curlRenameGroup = `curl -X PUT "${origin}/api/groups/by-name/${encodeURIComponent(renameGroupOldName || '{old_name}')}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}" \\
  -d '{"name": "${renameGroupNewName || 'new_name'}"}'`;

  const curlMoveDocument = `curl -X PUT "${origin}/api/documents/${moveDocId || '{doc_id}'}/move" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}" \\
  -d '{"group_name": "${moveTargetGroupName || 'target_group'}"}'`;

  const curlDocuments = `curl -X POST "${origin}/documents" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "content": "${documentContent.replace(/"/g, '\\"').slice(0, 50)}...",
    "metadata": {
      "groupName": "${documentGroupName}",
      "category": "${documentCategory}",
      "source": "${documentSource}"
    }
  }'`;

  const curlSearch = `curl -X GET "${origin}/search?query=${encodeURIComponent(searchQuery)}${searchGroupName.trim() ? `&group_name=${encodeURIComponent(searchGroupName.trim())}` : ''}" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}"`;

  const curlChat = `curl -X POST "${origin}/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "model": "${effectiveModel || 'default'}",
    "messages": [{"role": "user", "content": "${chatQuery}"}],
    "stream": true
  }'`;

  const curlUpdateDocument = `curl -X PUT "${origin}/api/documents/${updateDocId || '{doc_id}'}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "content": "${updateContent.replace(/"/g, '\\"').slice(0, 50)}...",
    "metadata": ${updateMetadata}
  }'`;

  const curlDeleteDocument = `curl -X DELETE "${origin}/api/documents/${deleteDocId || '{doc_id}'}" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}"`;

  const curlListGroups = `curl -X GET "${origin}/api/groups" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}"`;

  const curlListDocsInGroup = `curl -X GET "${origin}/api/groups/by-name/${encodeURIComponent(listDocsGroupName || '{group_name}')}/documents" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}"`;

  const curlGetDocWithVector = `curl -X GET "${origin}/api/groups/by-name/${encodeURIComponent(getDocGroupName || '{group_name}')}/documents/${getDocId || '{doc_id}'}?include_vector=true" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}"`;

  const curlDeleteGroup = deleteByName
    ? `curl -X DELETE "${origin}/api/groups/by-name/${encodeURIComponent(deleteGroupName || '{group_name}')}?delete_documents=${deleteGroupWithDocs}" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}"`
    : `curl -X DELETE "${origin}/api/groups/${deleteGroupId || '{group_id}'}?delete_documents=${deleteGroupWithDocs}" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}"`;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full border border-blue-100">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">Interactive Demo</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900">RAG Workflow Demo</h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Experience the complete RAG (Retrieval-Augmented Generation) workflow. 
          Follow the three steps below to add documents, search, and chat with your knowledge base.
        </p>
      </div>

      {/* API Key Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <Key className="w-5 h-5 text-yellow-700" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">API Key</h3>
            <p className="text-sm text-slate-500">Select an API key to authenticate your requests</p>
          </div>
        </div>
        
        {loadingKeys ? (
          <div className="text-sm text-slate-500">Loading keys...</div>
        ) : apiKeys.length > 0 ? (
          <select
            value={selectedApiKey}
            onChange={(e) => setSelectedApiKey(e.target.value)}
            className="w-full max-w-md bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-3"
          >
            {apiKeys.map((key) => (
              <option key={key.id} value={key.key}>
                {key.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-sm text-slate-500 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
            No API keys found. Please create one in your Profile.
          </div>
        )}
      </div>

      {/* Workflow Steps */}
      <div className="space-y-6">
        {/* Step 1: Add Document */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step1Status.completed ? "bg-green-100" : "bg-blue-100"
              }`}>
                {step1Status.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-lg font-bold text-blue-600">1</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Add Document</h3>
                </div>
                <p className="text-sm text-slate-500">Store content in your knowledge base with vector embeddings</p>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                POST /documents
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Document Content</label>
              <textarea
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
                className="w-full h-32 p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Enter your document content..."
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Folder <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={documentGroupName}
                  onChange={(e) => setDocumentGroupName(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., AI Knowledge"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category <span className="text-slate-400 font-normal">(tag)</span>
                </label>
                <input
                  type="text"
                  value={documentCategory}
                  onChange={(e) => setDocumentCategory(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., technology"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Source <span className="text-slate-400 font-normal">(tag)</span>
                </label>
                <input
                  type="text"
                  value={documentSource}
                  onChange={(e) => setDocumentSource(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., demo"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleAddDocument}
                disabled={step1Status.loading || !documentContent.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
              >
                {step1Status.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run
              </button>
            </div>
            
            {/* cURL Example */}
            <div className="bg-slate-900 rounded-lg p-4 group relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {curlDocuments}
              </pre>
              <button
                onClick={() => copyToClipboard(curlDocuments)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {/* Result */}
            {step1Status.completed && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">Document Added Successfully</span>
                </div>
                <pre className="text-xs text-green-800 font-mono">
                  {JSON.stringify(step1Status.result, null, 2)}
                </pre>
                <p className="text-xs text-green-600 mt-2">
                  Document ID auto-filled in Steps 4 &amp; 5. You can now test Update/Delete.
                </p>
              </div>
            )}
            
            {step1Status.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                Error: {step1Status.error}
              </div>
            )}
          </div>
          
          {/* Arrow Connector */}
          <div className="flex justify-center py-2 bg-slate-50">
            <ChevronRight className="w-6 h-6 text-slate-400 rotate-90" />
          </div>
        </div>

        {/* Step 2: Search */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step2Status.completed ? "bg-green-100" : "bg-purple-100"
              }`}>
                {step2Status.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-lg font-bold text-purple-600">2</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Search Documents</h3>
                </div>
                <p className="text-sm text-slate-500">Use semantic search to find relevant documents</p>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                GET /search
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Search Query</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your search query..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Folder <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={searchGroupName}
                  onChange={(e) => setSearchGroupName(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., AI Knowledge"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleSearch}
                disabled={step2Status.loading || !searchQuery.trim()}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
              >
                {step2Status.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run
              </button>
            </div>
            
            {/* cURL Example */}
            <div className="bg-slate-900 rounded-lg p-4 group relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {curlSearch}
              </pre>
              <button
                onClick={() => copyToClipboard(curlSearch)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Found {searchResults.length} result(s)</span>
                </div>
                {searchResults.map((result, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500">
                        Distance: {result.distance.toFixed(4)}
                      </span>
                      {result.metadata?.category && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {String(result.metadata.category)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-3">{result.content}</p>
                  </div>
                ))}
              </div>
            )}
            
            {step2Status.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                Error: {step2Status.error}
              </div>
            )}
          </div>
          
          {/* Arrow Connector */}
          <div className="flex justify-center py-2 bg-slate-50">
            <ChevronRight className="w-6 h-6 text-slate-400 rotate-90" />
          </div>
        </div>

        {/* Step 3: Chat */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step3Status.completed ? "bg-green-100" : "bg-green-100"
              }`}>
                {step3Status.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-lg font-bold text-green-600">3</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Chat with RAG</h3>
                </div>
                <p className="text-sm text-slate-500">Ask questions and get AI-powered answers from your documents</p>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                POST /v1/chat/completions
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Your Question</label>
              <input
                type="text"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ask a question..."
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {models.length > 0 ? (
                    models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.id}
                      </option>
                    ))
                  ) : (
                    <option value="">Loading models...</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Document Group <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={chatGroupName}
                  onChange={(e) => setChatGroupName(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., AI Knowledge"
                />
              </div>
            </div>
            
            {chatGroupName.trim() && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                RAG will search only in &quot;{chatGroupName.trim()}&quot; group (model: {effectiveModel})
              </p>
            )}
            
            <div className="flex justify-end">
              <button
                onClick={handleChat}
                disabled={step3Status.loading || !chatQuery.trim()}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
              >
                {step3Status.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run
              </button>
            </div>
            
            {/* cURL Example */}
            <div className="bg-slate-900 rounded-lg p-4 group relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {curlChat}
              </pre>
              <button
                onClick={() => copyToClipboard(curlChat)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {/* Chat Messages */}
            {messages.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4 max-h-80 overflow-y-auto">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-slate-200 text-slate-700"
                    }`}>
                      <div className="text-sm">
                        {msg.role === "user" ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <Markdown content={msg.content || (step3Status.loading ? "Thinking..." : "")} />
                        )}
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-slate-600" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
            
            {step3Status.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                Error: {step3Status.error}
              </div>
            )}
          </div>
        </div>

        {/* Step 4: Update Document */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step4Status.completed ? "bg-green-100" : "bg-orange-100"
              }`}>
                {step4Status.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-lg font-bold text-orange-600">4</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Edit className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Update Document</h3>
                </div>
                <p className="text-sm text-slate-500">Edit document content and metadata (auto re-vectorizes)</p>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                PUT /api/documents/:id
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Document ID
                  {step1Status.completed && (
                    <span className="text-green-600 font-normal ml-2">(auto-filled from Step 1)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={updateDocId}
                  onChange={(e) => setUpdateDocId(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Run Step 1 first, or enter a document ID"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Content <span className="text-slate-400 font-normal">(triggers re-vectorization)</span>
                </label>
                <input
                  type="text"
                  value={updateContent}
                  onChange={(e) => setUpdateContent(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="New document content..."
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                New Metadata <span className="text-slate-400 font-normal">(JSON format)</span>
              </label>
              <input
                type="text"
                value={updateMetadata}
                onChange={(e) => setUpdateMetadata(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 font-mono"
                placeholder='{"key": "value"}'
              />
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleUpdateDocument}
                disabled={step4Status.loading || !updateDocId.trim()}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
              >
                {step4Status.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run
              </button>
            </div>
            
            {/* cURL Example */}
            <div className="bg-slate-900 rounded-lg p-4 group relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {curlUpdateDocument}
              </pre>
              <button
                onClick={() => copyToClipboard(curlUpdateDocument)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {/* Result */}
            {step4Status.completed && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">Document Updated Successfully</span>
                </div>
                <pre className="text-xs text-green-800 font-mono overflow-x-auto">
                  {JSON.stringify(step4Status.result, null, 2)}
                </pre>
              </div>
            )}
            
            {step4Status.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                Error: {step4Status.error}
              </div>
            )}
          </div>
          
          {/* Arrow Connector */}
          <div className="flex justify-center py-2 bg-slate-50">
            <ChevronRight className="w-6 h-6 text-slate-400 rotate-90" />
          </div>
        </div>

        {/* Step 5: Delete Document */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step5Status.completed ? "bg-green-100" : "bg-red-100"
              }`}>
                {step5Status.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-lg font-bold text-red-600">5</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Delete Document</h3>
                </div>
                <p className="text-sm text-slate-500">Remove a document from your knowledge base</p>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                DELETE /api/documents/:id
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Document ID to Delete
                {step1Status.completed && (
                  <span className="text-green-600 font-normal ml-2">(auto-filled from Step 1)</span>
                )}
              </label>
              <input
                type="text"
                value={deleteDocId}
                onChange={(e) => setDeleteDocId(e.target.value)}
                className="w-full max-w-xs p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Run Step 1 first, or enter a document ID"
              />
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleDeleteDocument}
                disabled={step5Status.loading || !deleteDocId.trim()}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
              >
                {step5Status.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            </div>
            
            {/* cURL Example */}
            <div className="bg-slate-900 rounded-lg p-4 group relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {curlDeleteDocument}
              </pre>
              <button
                onClick={() => copyToClipboard(curlDeleteDocument)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {/* Result */}
            {step5Status.completed && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">Document Deleted Successfully</span>
                </div>
                <pre className="text-xs text-green-800 font-mono">
                  {JSON.stringify(step5Status.result, null, 2)}
                </pre>
              </div>
            )}
            
            {step5Status.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                Error: {step5Status.error}
              </div>
            )}
          </div>
          
          {/* Arrow Connector */}
          <div className="flex justify-center py-2 bg-slate-50">
            <ChevronRight className="w-6 h-6 text-slate-400 rotate-90" />
          </div>
        </div>

        {/* Step 6: List Groups */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step6Status.completed ? "bg-green-100" : "bg-cyan-100"
              }`}>
                {step6Status.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-lg font-bold text-cyan-600">6</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <List className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">List Groups</h3>
                </div>
                <p className="text-sm text-slate-500">Get all document groups with their document counts</p>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                GET /api/groups
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="flex justify-end">
              <button
                onClick={handleListGroups}
                disabled={step6Status.loading}
                className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
              >
                {step6Status.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run
              </button>
            </div>
            
            {/* cURL Example */}
            <div className="bg-slate-900 rounded-lg p-4 group relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {curlListGroups}
              </pre>
              <button
                onClick={() => copyToClipboard(curlListGroups)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {/* Groups List */}
            {groupsList.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Found {groupsList.length} group(s)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupsList.map((group) => (
                    <div
                      key={group.id}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => {
                        setDeleteGroupId(String(group.id));
                        setDeleteGroupName(group.name);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">{group.name}</span>
                        <span className="text-xs px-2 py-1 bg-cyan-100 text-cyan-700 rounded">
                          {group.documentCount} docs
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">ID: {group.id}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">Click a group to auto-fill it for Steps 7-9</p>
              </div>
            )}
            
            {step6Status.completed && groupsList.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700 text-sm">
                No groups found. Create a document with a folder name first.
              </div>
            )}
            
            {step6Status.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                Error: {step6Status.error}
              </div>
            )}
          </div>
          
          {/* Arrow Connector */}
          <div className="flex justify-center py-2 bg-slate-50">
            <ChevronRight className="w-6 h-6 text-slate-400 rotate-90" />
          </div>
        </div>

        {/* Step 7: List Documents in Group */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step7Status.completed ? "bg-green-100" : "bg-indigo-100"
              }`}>
                {step7Status.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-lg font-bold text-indigo-600">7</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileSearch className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">List Documents in Group</h3>
                </div>
                <p className="text-sm text-slate-500">Get all documents in a group by group name</p>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                GET /api/groups/by-name/:name/documents
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Group Name
                {step6Status.completed && groupsList.length > 0 && (
                  <span className="text-green-600 font-normal ml-2">(auto-filled from Step 6)</span>
                )}
              </label>
              <input
                type="text"
                value={listDocsGroupName}
                onChange={(e) => setListDocsGroupName(e.target.value)}
                className="w-full max-w-md p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter group name (case-sensitive)"
              />
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleListDocsInGroup}
                disabled={step7Status.loading || !listDocsGroupName.trim()}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
              >
                {step7Status.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run
              </button>
            </div>
            
            {/* cURL Example */}
            <div className="bg-slate-900 rounded-lg p-4 group relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {curlListDocsInGroup}
              </pre>
              <button
                onClick={() => copyToClipboard(curlListDocsInGroup)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {/* Documents List */}
            {groupDocsList.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Found {groupDocsList.length} document(s)</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {groupDocsList.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => {
                        setGetDocId(String(doc.id));
                        setGetDocGroupName(listDocsGroupName);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-900">ID: {doc.id}</span>
                        {doc.metadata?.category && (
                          <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded">
                            {String(doc.metadata.category)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{doc.content}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">Click a document to auto-fill it for Step 8</p>
              </div>
            )}
            
            {step7Status.completed && groupDocsList.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700 text-sm">
                No documents found in this group.
              </div>
            )}
            
            {step7Status.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                Error: {step7Status.error}
              </div>
            )}
          </div>
          
          {/* Arrow Connector */}
          <div className="flex justify-center py-2 bg-slate-50">
            <ChevronRight className="w-6 h-6 text-slate-400 rotate-90" />
          </div>
        </div>

        {/* Step 8: Get Document with Vector */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step8Status.completed ? "bg-green-100" : "bg-violet-100"
              }`}>
                {step8Status.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-lg font-bold text-violet-600">8</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Get Document with Vector</h3>
                </div>
                <p className="text-sm text-slate-500">Get document content and embedding vector</p>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                GET /api/groups/by-name/:name/documents/:id
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Group Name
                  {step7Status.completed && groupDocsList.length > 0 && (
                    <span className="text-green-600 font-normal ml-2">(from Step 7)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={getDocGroupName}
                  onChange={(e) => setGetDocGroupName(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter group name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Document ID
                  {step7Status.completed && groupDocsList.length > 0 && (
                    <span className="text-green-600 font-normal ml-2">(click doc in Step 7)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={getDocId}
                  onChange={(e) => setGetDocId(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter document ID"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleGetDocWithVector}
                disabled={step8Status.loading || !getDocGroupName.trim() || !getDocId.trim()}
                className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
              >
                {step8Status.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run
              </button>
            </div>
            
            {/* cURL Example */}
            <div className="bg-slate-900 rounded-lg p-4 group relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {curlGetDocWithVector}
              </pre>
              <button
                onClick={() => copyToClipboard(curlGetDocWithVector)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {/* Document Result */}
            {documentWithVector && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Document Retrieved</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <div>
                    <span className="text-xs font-medium text-slate-500">ID</span>
                    <p className="text-sm text-slate-900">{documentWithVector.id}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500">Content</span>
                    <p className="text-sm text-slate-700">{documentWithVector.content}</p>
                  </div>
                  {documentWithVector.embedding && (
                    <div>
                      <span className="text-xs font-medium text-slate-500">
                        Embedding Vector ({documentWithVector.embedding.length} dimensions)
                      </span>
                      <div className="bg-slate-100 rounded p-2 mt-1 max-h-32 overflow-y-auto">
                        <code className="text-xs text-slate-600 break-all">
                          [{documentWithVector.embedding.slice(0, 10).map(v => v.toFixed(6)).join(', ')}
                          {documentWithVector.embedding.length > 10 && `, ... (${documentWithVector.embedding.length - 10} more)`}]
                        </code>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {step8Status.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                Error: {step8Status.error}
              </div>
            )}
          </div>
          
          {/* Arrow Connector */}
          <div className="flex justify-center py-2 bg-slate-50">
            <ChevronRight className="w-6 h-6 text-slate-400 rotate-90" />
          </div>
        </div>

        {/* Step 9: Delete Group */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step9Status.completed ? "bg-green-100" : "bg-pink-100"
              }`}>
                {step9Status.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-lg font-bold text-pink-600">9</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FolderMinus className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Delete Group</h3>
                </div>
                <p className="text-sm text-slate-500">Remove a group by ID or name, with all its documents</p>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                DELETE /api/groups/:id or /by-name/:name
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            {/* Delete method toggle */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Delete By</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteBy"
                    checked={!deleteByName}
                    onChange={() => setDeleteByName(false)}
                    className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                  />
                  <span className="text-sm text-slate-700">Group ID</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteBy"
                    checked={deleteByName}
                    onChange={() => setDeleteByName(true)}
                    className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                  />
                  <span className="text-sm text-slate-700">Group Name</span>
                </label>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!deleteByName ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Group ID to Delete
                    {step6Status.completed && groupsList.length > 0 && (
                      <span className="text-green-600 font-normal ml-2">(click a group in Step 6)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={deleteGroupId}
                    onChange={(e) => setDeleteGroupId(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Run Step 6 first, or enter a group ID"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Group Name to Delete
                    {step6Status.completed && groupsList.length > 0 && (
                      <span className="text-green-600 font-normal ml-2">(click a group in Step 6)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={deleteGroupName}
                    onChange={(e) => setDeleteGroupName(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter group name (case-sensitive)"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Delete Documents in Group?</label>
                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteGroupWithDocs"
                      checked={deleteGroupWithDocs}
                      onChange={() => setDeleteGroupWithDocs(true)}
                      className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-slate-700">Yes, delete all documents</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteGroupWithDocs"
                      checked={!deleteGroupWithDocs}
                      onChange={() => setDeleteGroupWithDocs(false)}
                      className="w-4 h-4 text-slate-600 focus:ring-slate-500"
                    />
                    <span className="text-sm text-slate-700">No, keep documents</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleDeleteGroup}
                disabled={step9Status.loading || (deleteByName ? !deleteGroupName.trim() : !deleteGroupId.trim())}
                className="px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
              >
                {step9Status.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderMinus className="w-4 h-4" />
                )}
                Delete Group
              </button>
            </div>
            
            {/* cURL Example */}
            <div className="bg-slate-900 rounded-lg p-4 group relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {curlDeleteGroup}
              </pre>
              <button
                onClick={() => copyToClipboard(curlDeleteGroup)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {/* Result */}
            {step9Status.completed && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">Group Deleted Successfully</span>
                </div>
                <pre className="text-xs text-green-800 font-mono">
                  {JSON.stringify(step9Status.result, null, 2)}
                </pre>
              </div>
            )}
            
            {step9Status.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                Error: {step9Status.error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced API Operations */}
      <AdvancedApiDemo
        apiKey={selectedApiKey}
        onAuthRequired={() => setShowAuthAlert(true)}
      />

      {/* Workflow Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          Complete Workflow
        </h3>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-slate-700">Add</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <Search className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-slate-700">Search</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs font-medium text-slate-700">Chat</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <Edit className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-slate-700">Update</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            <span className="text-xs font-medium text-slate-700">Delete</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center">
              <List className="w-4 h-4 text-cyan-600" />
            </div>
            <span className="text-xs font-medium text-slate-700">List</span>
          </div>
        </div>
        <p className="text-center text-sm text-slate-500 mt-4">
          Full CRUD operations: Add, Search, Chat, Update, and Delete - all with API Key authentication.
        </p>
      </div>

      <AlertModal
        isOpen={showAuthAlert}
        onClose={() => setShowAuthAlert(false)}
        title="API Key Required"
        message="Please select an API Key to continue. If you don't have one, please create one in your Profile."
        variant="info"
      />
    </div>
  );
}