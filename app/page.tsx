'use client';
import { useState, useRef, useEffect } from 'react';
import { Folder, FolderOpen, FileCode, Play, Monitor, Terminal, FilePlus, FolderPlus, ChevronDown, ChevronRight, Copy, Scissors, Clipboard, Trash2, HelpCircle, Menu, X, Download, Import } from 'lucide-react';

interface FileSystemNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  isOpen?: boolean;
  children?: FileSystemNode[];
}

interface ClipboardState {
  node: FileSystemNode;
  action: 'copy' | 'cut';
}

const DEFAULT_WORKSPACE: FileSystemNode[] = [
  {
    id: 'root-project',
    name: 'my_project',
    type: 'folder',
    isOpen: true,
    children: [
      { id: 'file-main', name: 'main.py', type: 'file', content: 'print("Welcome to PyMobile IDE!")\n\nfor i in range(3):\n    print(f"Executing sequence line {i+1}")\n' },
      { id: 'file-utils', name: 'utils.py', type: 'file', content: 'def process_data():\n    return "Data parsed successfully!"\n' }
    ]
  }
];

// --- RECURSIVE SYSTEM UTILITIES ---

const toggleFolderOpenTree = (nodes: FileSystemNode[], folderId: string): FileSystemNode[] => {
  return nodes.map((node) => {
    if (node.id === folderId && node.type === 'folder') {
      return { ...node, isOpen: !node.isOpen };
    } else if (node.children) {
      return { ...node, children: toggleFolderOpenTree(node.children, folderId) };
    }
    return node;
  });
};

const insertNodeTree = (nodes: FileSystemNode[], targetId: string, newNode: FileSystemNode): FileSystemNode[] => {
  return nodes.map((node) => {
    if (node.id === targetId && node.type === 'folder') {
      return {
        ...node,
        isOpen: true,
        children: [...(node.children || []), newNode]
      };
    } else if (node.children) {
      return { ...node, children: insertNodeTree(node.children, targetId, newNode) };
    }
    return node;
  });
};

const updateFileContentTree = (nodes: FileSystemNode[], fileName: string, newContent: string): FileSystemNode[] => {
  return nodes.map((node) => {
    if (node.type === 'file' && node.name === fileName) {
      return { ...node, content: newContent };
    } else if (node.children) {
      return { ...node, children: updateFileContentTree(node.children, fileName, newContent) };
    }
    return node;
  });
};

const removeNodeTree = (nodes: FileSystemNode[], targetId: string): FileSystemNode[] => {
  return nodes
    .filter((node) => node.id !== targetId)
    .map((node) => {
      if (node.children) {
        return { ...node, children: removeNodeTree(node.children, targetId) };
      }
      return node;
    });
};

const removeNodeByNameTree = (nodes: FileSystemNode[], targetId: string | null, targetName: string): FileSystemNode[] => {
  if (!targetId) {
    return nodes.filter(n => n.name !== targetName);
  }
  return nodes.map((node) => {
    if (node.id === targetId && node.type === 'folder') {
      return {
        ...node,
        children: (node.children || []).filter(c => c.name !== targetName)
      };
    } else if (node.children) {
      return { ...node, children: removeNodeByNameTree(node.children, targetId, targetName) };
    }
    return node;
  });
};

const findFolderByPath = (nodes: FileSystemNode[], pathSegments: string[]): FileSystemNode | null => {
  if (pathSegments.length === 0) return null;
  const currentSegment = pathSegments[0];
  
  const match = nodes.find(n => n.type === 'folder' && n.name === currentSegment);
  if (!match) return null;
  
  if (pathSegments.length === 1) return match;
  return findFolderByPath(match.children || [], pathSegments.slice(1));
};

const findFileInTarget = (nodes: FileSystemNode[], targetId: string | null, fileName: string): FileSystemNode | null => {
  if (!targetId) {
    return nodes.find(n => n.type === 'file' && n.name === fileName) || null;
  }
  
  let result: FileSystemNode | null = null;
  const findInTree = (currentNodes: FileSystemNode[]) => {
    for (const node of currentNodes) {
      if (node.id === targetId && node.type === 'folder') {
        result = (node.children || []).find(c => c.type === 'file' && c.name === fileName) || null;
        break;
      }
      if (node.children) findInTree(node.children);
    }
  };
  findInTree(nodes);
  return result;
};

// --- MOBILE COMPONENTS (defined outside render) ---

interface MobileExplorerProps {
  isExplorerOpen: boolean;
  setIsExplorerOpen: (open: boolean) => void;
  explorerRef: React.RefObject<HTMLDivElement | null>;
  fileSystem: FileSystemNode[];
  renderTree: (nodes: FileSystemNode[]) => React.ReactNode;
  getTargetNodeName: (id: string | null) => string;
  selectedFolderId: string | null;
  internalClipboard: ClipboardState | null;
  handlePaste: (e: React.MouseEvent) => void;
  isCreatingFile: boolean;
  isCreatingFolder: boolean;
  setIsCreatingFile: (creating: boolean) => void;
  setIsCreatingFolder: (creating: boolean) => void;
  newItemName: string;
  setNewItemName: (name: string) => void;
  handleInlineSubmit: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  cancelCreation: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const MobileExplorer: React.FC<MobileExplorerProps> = ({
  isExplorerOpen,
  setIsExplorerOpen,
  explorerRef,
  fileSystem,
  renderTree,
  getTargetNodeName,
  selectedFolderId,
  internalClipboard,
  handlePaste,
  isCreatingFile,
  isCreatingFolder,
  setIsCreatingFile,
  setIsCreatingFolder,
  newItemName,
  setNewItemName,
  handleInlineSubmit,
  cancelCreation,
  inputRef
}) => (
  <div 
    ref={explorerRef}
    className={`md:hidden fixed inset-y-0 left-0 w-80 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-300 ease-in-out z-50 shadow-2xl ${
      isExplorerOpen ? 'translate-x-0' : '-translate-x-full'
    }`}
  >
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b border-zinc-800">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">File Explorer</span>
          <span className="text-[10px] text-blue-400 font-mono font-medium block truncate max-w-45">
            /{getTargetNodeName(selectedFolderId)}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          {internalClipboard && (
            <button onClick={handlePaste} className="p-1.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600 transition"><Clipboard className="w-4 h-4" /></button>
          )}
          <button onClick={(e) => { e.stopPropagation(); setIsCreatingFolder(false); setIsCreatingFile(true); }} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition"><FilePlus className="w-4 h-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); setIsCreatingFile(false); setIsCreatingFolder(true); }} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition"><FolderPlus className="w-4 h-4" /></button>
          <button onClick={() => setIsExplorerOpen(false)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 font-mono custom-scrollbar">
        {renderTree(fileSystem)}
        {!selectedFolderId && (isCreatingFile || isCreatingFolder) && (
          <div className="flex items-center pl-2 my-2">
            <input ref={inputRef} type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={handleInlineSubmit} onBlur={cancelCreation} placeholder={isCreatingFolder ? "New folder..." : "New file.py..."} className="bg-zinc-900 border border-blue-500 text-xs rounded px-1.5 py-0.5 text-zinc-100 focus:outline-none w-full font-mono" />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-blue-400 shrink-0" />
          <span>Quick Commands</span>
        </div>
        <p className="text-[10px] text-zinc-500 leading-relaxed font-mono mt-1">
          ls • mkdir test • touch main.py • python main.py
        </p>
      </div>
    </div>
  </div>
);

interface ExplorerToggleButtonProps {
  setIsExplorerOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const ExplorerToggleButton: React.FC<ExplorerToggleButtonProps> = ({ setIsExplorerOpen }) => (
  <button
    onClick={() => setIsExplorerOpen((prev: boolean) => !prev)}
    className="md:hidden fixed bottom-24 right-4 z-50 p-3 bg-blue-600 rounded-full shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all active:scale-95"
  >
    <Folder className="w-6 h-6 text-white" />
  </button>
);

export default function Home() {
  const [fileSystem, setFileSystem] = useState<FileSystemNode[]>(() => {
    if (typeof window !== 'undefined') {
      const savedTree = localStorage.getItem('pymobile_workspace_tree');
      if (savedTree) {
        try { return JSON.parse(savedTree); } catch { return DEFAULT_WORKSPACE; }
      }
    }
    return DEFAULT_WORKSPACE;
  });

  const [activeFile, setActiveFile] = useState<{ name: string; content: string }>({
    name: 'main.py',
    content: 'print("Welcome to PyMobile IDE!")\n\nfor i in range(3):\n    print(f"Executing sequence line {i+1}")\n'
  });

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>('root-project');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [internalClipboard, setInternalClipboard] = useState<ClipboardState | null>(null);
  
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'PyMobile Terminal Environment Initialized.',
    'Ready for shell commands: pwd, ls, mkdir, touch, rm, cd, python'
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  
  // Mobile-specific states
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Import/Export states
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const explorerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    localStorage.setItem('pymobile_workspace_tree', JSON.stringify(fileSystem));
  }, [fileSystem]);

  useEffect(() => {
    if ((isCreatingFile || isCreatingFolder) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreatingFile, isCreatingFolder]);

  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // Close explorer when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isMobile && isExplorerOpen && explorerRef.current && !explorerRef.current.contains(e.target as Node)) {
        setIsExplorerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isExplorerOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && focusedNodeId) {
        e.preventDefault();
        
        let wasActiveFile = false;
        const checkActiveNode = (nodes: FileSystemNode[]) => {
          for (const n of nodes) {
            if (n.id === focusedNodeId && n.type === 'file' && n.name === activeFile.name) {
              wasActiveFile = true;
              break;
            }
            if (n.children) checkActiveNode(n.children);
          }
        };
        checkActiveNode(fileSystem);

        setFileSystem(prev => removeNodeTree(prev, focusedNodeId));
        if (selectedFolderId === focusedNodeId) setSelectedFolderId(null);
        if (wasActiveFile) {
          setActiveFile({ name: 'empty', content: '# Select or create another file module to get coding!' });
        }

        setTerminalLogs(prev => [...prev, 'System: Item deleted successfully via keyboard.']);
        setFocusedNodeId(null);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [focusedNodeId, selectedFolderId, activeFile, fileSystem]);

  const runPythonCode = async (codeContent: string) => {
    setLoading(true);
    setTerminalLogs(prev => [...prev, 'Executing script modules...']);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeContent }),
      });
      const data = await res.json();
      setTerminalLogs(prev => [...prev, data.output]);
    } catch {
      setTerminalLogs(prev => [...prev, 'Error: Could not connect to code execution runner server.']);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = () => {
    runPythonCode(activeFile.content);
  };

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextContent = e.target.value;
    setActiveFile(prev => ({ ...prev, content: nextContent }));
    setFileSystem(prevTree => updateFileContentTree(prevTree, activeFile.name, nextContent));
  };

  const getTargetNodeName = (id: string | null): string => {
    if (!id) return 'root';
    let foundName = 'unknown';
    const find = (nodes: FileSystemNode[]) => {
      for (const n of nodes) {
        if (n.id === id) { foundName = n.name; break; }
        if (n.children) find(n.children);
      }
    };
    find(fileSystem);
    return foundName;
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const commandLine = terminalInput.trim();
    if (!commandLine) return;

    setTerminalLogs(prev => [...prev, `pymobile:~# ${commandLine}`]);
    setTerminalInput('');

    const segments = commandLine.split(/\s+/);
    const command = segments[0].toLowerCase();
    const argument = segments.slice(1).join(' ');

    switch (command) {
      case 'clear':
        setTerminalLogs([]);
        break;

      case 'pwd':
        setTerminalLogs(prev => [...prev, `/${getTargetNodeName(selectedFolderId)}`]);
        break;

      case 'ls': {
        const currentFolder = fileSystem.find(n => n.id === selectedFolderId);
        const targets = currentFolder ? currentFolder.children || [] : fileSystem;
        if (targets.length === 0) {
          setTerminalLogs(prev => [...prev, '(directory is empty)']);
        } else {
          const listOutput = targets.map(t => t.type === 'folder' ? `${t.name}/` : t.name).join('    ');
          setTerminalLogs(prev => [...prev, listOutput]);
        }
        break;
      }

      case 'cd':
        if (!argument || argument === '/' || argument === '..') {
          setSelectedFolderId(null);
          setTerminalLogs(prev => [...prev, 'Directory target changed to: Workspace Root']);
        } else {
          const pathParts = argument.replace(/^\/+|\/+$/g, '').split('/');
          const targetNode = findFolderByPath(fileSystem, pathParts);
          if (targetNode) {
            setSelectedFolderId(targetNode.id);
            setTerminalLogs(prev => [...prev, `Path moved to: ${targetNode.name}/`]);
          } else {
            setTerminalLogs(prev => [...prev, `cd: directory not found: "${argument}"`]);
          }
        }
        break;

      case 'mkdir': {
        if (!argument) {
          setTerminalLogs(prev => [...prev, 'mkdir: missing argument template lookup error']);
          break;
        }
        const cleanDirName = argument.replace(/[^a-zA-Z0-9_\-.]/g, '');
        const newFolderNode: FileSystemNode = {
          id: `node_${window.crypto.randomUUID()}`,
          name: cleanDirName,
          type: 'folder',
          isOpen: true,
          children: []
        };
        if (selectedFolderId) {
          setFileSystem(prev => insertNodeTree(prev, selectedFolderId, newFolderNode));
        } else {
          setFileSystem(prev => [...prev, newFolderNode]);
        }
        setTerminalLogs(prev => [...prev, `Created folder: "${cleanDirName}"`]);
        break;
      }

      case 'touch': {
        if (!argument) {
          setTerminalLogs(prev => [...prev, 'touch: missing filename template lookup error']);
          break;
        }
        let cleanFileName = argument.replace(/[^a-zA-Z0-9_\-.]/g, '');
        if (!cleanFileName.includes('.')) cleanFileName += '.py';

        const newFileNode: FileSystemNode = {
          id: `node_${window.crypto.randomUUID()}`,
          name: cleanFileName,
          type: 'file',
          content: `# Module ${cleanFileName}\nprint("Running runtime code sequence line.")\n`
        };

        if (selectedFolderId) {
          setFileSystem(prev => insertNodeTree(prev, selectedFolderId, newFileNode));
        } else {
          setFileSystem(prev => [...prev, newFileNode]);
        }
        setActiveFile({ name: cleanFileName, content: newFileNode.content || '' });
        setTerminalLogs(prev => [...prev, `Created file: "${cleanFileName}"`]);
        break;
      }

      case 'rm': {
        if (!argument) {
          setTerminalLogs(prev => [...prev, 'rm: missing targeted deletion token name']);
          break;
        }
        setFileSystem(prev => removeNodeByNameTree(prev, selectedFolderId, argument));
        setTerminalLogs(prev => [...prev, `Removed system workspace target item: "${argument}"`]);
        break;
      }

      case 'python':
      case 'python3': {
        if (!argument) {
          setTerminalLogs(prev => [...prev, 'python: missing runtime target script parameter path. Try "python main.py"']);
          break;
        }
        
        const fileMatch = findFileInTarget(fileSystem, selectedFolderId, argument);
        if (fileMatch) {
          runPythonCode(fileMatch.content || '');
        } else {
          setTerminalLogs(prev => [...prev, `python: error: can't open file '${argument}': No such file or directory`]);
        }
        break;
      }

      default:
        setTerminalLogs(prev => [...prev, `Command "${command}" unrecognized. Valid console codes: mkdir, touch, ls, pwd, rm, cd, python`]);
        break;
    }
  };

  const handleCopy = (e: React.MouseEvent, node: FileSystemNode) => {
    e.stopPropagation();
    setInternalClipboard({ node, action: 'copy' });
    setTerminalLogs(prev => [...prev, `Copied "${node.name}" to clipboard resource.`]);
  };

  const handleCut = (e: React.MouseEvent, node: FileSystemNode) => {
    e.stopPropagation();
    setInternalClipboard({ node, action: 'cut' });
    setTerminalLogs(prev => [...prev, `Cut "${node.name}" to clipboard transfer queue.`]);
  };

  const handlePaste = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!internalClipboard) return;

    const { node: sourceNode, action } = internalClipboard;
    const cloneNodeWithNewIds = (target: FileSystemNode): FileSystemNode => ({
      ...target,
      id: `node_${window.crypto.randomUUID()}`,
      children: target.children ? target.children.map(cloneNodeWithNewIds) : undefined
    });

    const nodeToInsert = action === 'copy' ? cloneNodeWithNewIds(sourceNode) : sourceNode;
    let cleanTree = fileSystem;

    if (action === 'cut') cleanTree = removeNodeTree(cleanTree, sourceNode.id);

    if (selectedFolderId) {
      setFileSystem(insertNodeTree(cleanTree, selectedFolderId, nodeToInsert));
    } else {
      setFileSystem([...cleanTree, nodeToInsert]);
    }

    if (action === 'cut') setInternalClipboard(null);
    setTerminalLogs(prev => [...prev, `Relocated and pasted: ${sourceNode.name}`]);
  };

  const handleInlineSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { cancelCreation(); return; }
    if (e.key === 'Enter') {
      const name = newItemName.trim();
      if (!name) { cancelCreation(); return; }

      const generatedId = `node_${window.crypto.randomUUID()}`;
      let newEntry: FileSystemNode;

      if (isCreatingFile) {
        const checkedName = name.endsWith('.py') ? name : `${name}.py`;
        newEntry = { id: generatedId, name: checkedName, type: 'file', content: `# ${checkedName}\n` };
        setActiveFile({ name: checkedName, content: `# ${checkedName}\n` });
      } else {
        newEntry = { id: generatedId, name: name, type: 'folder', isOpen: true, children: [] };
      }

      if (selectedFolderId) {
        setFileSystem(insertNodeTree(fileSystem, selectedFolderId, newEntry));
      } else {
        setFileSystem([...fileSystem, newEntry]);
      }
      cancelCreation();
    }
  };

  const cancelCreation = () => {
    setIsCreatingFile(false);
    setIsCreatingFolder(false);
    setNewItemName('');
  };

  // --- EXPORT FUNCTIONALITY ---
  const exportWorkspace = () => {
    try {
      const data = JSON.stringify(fileSystem, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `workspace_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setTerminalLogs(prev => [...prev, '✅ Workspace exported successfully!']);
    } catch (error) {
      setTerminalLogs(prev => [...prev, '❌ Error exporting workspace']);
      console.error('Export error:', error);
    }
  };

  const exportFile = (node: FileSystemNode) => {
    if (node.type !== 'file' || !node.content) return;
    
    try {
      const blob = new Blob([node.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = node.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setTerminalLogs(prev => [...prev, `✅ Exported file: ${node.name}`]);
    } catch (error) {
      setTerminalLogs(prev => [...prev, `❌ Error exporting ${node.name}`]);
      console.error('Export error:', error);
    }
  };

  const exportFolder = async (node: FileSystemNode) => {
    if (node.type !== 'folder') return;
    
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      const addFilesToZip = (folderNode: FileSystemNode, path: string = '') => {
        if (!folderNode.children) return;
        
        for (const child of folderNode.children) {
          const childPath = path ? `${path}/${child.name}` : child.name;
          if (child.type === 'file' && child.content) {
            zip.file(childPath, child.content);
          } else if (child.type === 'folder') {
            zip.folder(childPath);
            addFilesToZip(child, childPath);
          }
        }
      };
      
      addFilesToZip(node);
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${node.name}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setTerminalLogs(prev => [...prev, `✅ Exported folder: ${node.name}.zip`]);
    } catch (error) {
      setTerminalLogs(prev => [...prev, `❌ Error exporting folder ${node.name}`]);
      console.error('Export folder error:', error);
    }
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const content = await file.text();
      const fileName = file.name;
      
      const existingFile = findFileInTarget(fileSystem, selectedFolderId, fileName);
      if (existingFile) {
        if (!confirm(`File "${fileName}" already exists. Do you want to replace it?`)) {
          return;
        }
        setFileSystem(prev => removeNodeTree(prev, existingFile.id));
      }
      
      const newFileNode: FileSystemNode = {
        id: `node_${window.crypto.randomUUID()}`,
        name: fileName,
        type: 'file',
        content: content
      };
      
      if (selectedFolderId) {
        setFileSystem(insertNodeTree(fileSystem, selectedFolderId, newFileNode));
      } else {
        setFileSystem([...fileSystem, newFileNode]);
      }
      
      setActiveFile({ name: fileName, content: content });
      setTerminalLogs(prev => [...prev, `✅ Imported file: ${fileName}`]);
      setIsImporting(false);
    } catch (error) {
      setTerminalLogs(prev => [...prev, `❌ Error importing file`]);
      console.error('Import file error:', error);
    }
    
    event.target.value = '';
  };

  // FIXED: Proper folder import with support for empty folders
  const importFolder = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setTerminalLogs(prev => [...prev, '❌ No files selected for import']);
      return;
    }
    
    try {
      // Get the root folder name from the first file's path
      const firstFile = files[0];
      const fullPath = firstFile.webkitRelativePath || firstFile.name;
      const pathParts = fullPath.split('/');
      
      // Determine folder name
      let folderName = 'imported_folder';
      if (pathParts.length > 1) {
        folderName = pathParts[0];
      } else {
        // If no relative path, use the file name without extension as folder name
        folderName = firstFile.name.replace(/\.[^/.]+$/, '') + '_folder';
      }
      
      // Check if folder already exists
      const existingFolder = fileSystem.find(n => n.type === 'folder' && n.name === folderName && n.id === selectedFolderId);
      if (existingFolder) {
        if (!confirm(`Folder "${folderName}" already exists. Do you want to merge the contents?`)) {
          setIsImporting(false);
          event.target.value = '';
          return;
        }
      }
      
      // Build folder structure from files
      const rootFolder: FileSystemNode = {
        id: `node_${window.crypto.randomUUID()}`,
        name: folderName,
        type: 'folder',
        isOpen: true,
        children: []
      };
      
      // Process all files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath || file.name;
        const parts = relativePath.split('/');
        
        // Read file content
        const content = await file.text();
        
        // Create file node
        const fileNode: FileSystemNode = {
          id: `node_${window.crypto.randomUUID()}`,
          name: parts[parts.length - 1],
          type: 'file',
          content: content
        };
        
        // If file is in root of the folder
        if (parts.length === 1 || (parts.length === 2 && parts[0] === folderName)) {
          rootFolder.children!.push(fileNode);
          continue;
        }
        
        // Handle nested folders
        const folderPath = parts.slice(1, parts.length - 1);
        let currentFolder = rootFolder;
        
        // Build the folder path
        for (const folderNamePart of folderPath) {
          let subFolder = currentFolder.children!.find(
            n => n.type === 'folder' && n.name === folderNamePart
          ) as FileSystemNode | undefined;
          
          if (!subFolder) {
            subFolder = {
              id: `node_${window.crypto.randomUUID()}`,
              name: folderNamePart,
              type: 'folder',
              isOpen: true,
              children: []
            };
            currentFolder.children!.push(subFolder);
          }
          currentFolder = subFolder;
        }
        
        // Add file to the last folder in the path
        currentFolder.children!.push(fileNode);
      }
      
      // Insert the folder into the file system
      if (selectedFolderId) {
        // Check if the folder already exists in the target
        const targetFolder = fileSystem.find(n => n.id === selectedFolderId);
        if (targetFolder) {
          // Check if a folder with the same name exists in the target
          const existingChild = targetFolder.children?.find(
            n => n.type === 'folder' && n.name === folderName
          );
          
          if (existingChild) {
            // Merge: copy all files from rootFolder to existingChild
            const existingChildNode = existingChild as FileSystemNode;
            if (rootFolder.children) {
              for (const child of rootFolder.children) {
                // Check if file already exists in the target folder
                const fileExists = existingChildNode.children?.some(
                  n => n.type === 'file' && n.name === child.name
                );
                if (!fileExists) {
                  existingChildNode.children!.push(child);
                }
              }
            }
            setTerminalLogs(prev => [...prev, `✅ Merged files into existing folder: ${folderName}`]);
          } else {
            // Add the new folder to the target
            setFileSystem(prev => insertNodeTree(prev, selectedFolderId, rootFolder));
            setTerminalLogs(prev => [...prev, `✅ Imported folder: ${folderName} (${rootFolder.children!.length} files)`]);
          }
        } else {
          // Target folder not found, add to root
          setFileSystem(prev => [...prev, rootFolder]);
          setTerminalLogs(prev => [...prev, `✅ Imported folder to root: ${folderName} (${rootFolder.children!.length} files)`]);
        }
      } else {
        // No selected folder, add to root
        setFileSystem(prev => [...prev, rootFolder]);
        setTerminalLogs(prev => [...prev, `✅ Imported folder to root: ${folderName} (${rootFolder.children!.length} files)`]);
      }
      
      setIsImporting(false);
    } catch (error) {
      console.error('Import folder error:', error);
      setTerminalLogs(prev => [...prev, `❌ Error importing folder: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
    
    event.target.value = '';
  };

  // FIXED: Import workspace with proper type checking
  const importWorkspace = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const content = await file.text();
      const data = JSON.parse(content);
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid workspace format');
      }
      
      if (!confirm('This will replace your current workspace. Continue?')) {
        return;
      }

      const cleanNodes = (nodes: Record<string, unknown>[]): FileSystemNode[] => {
        return nodes.map(node => ({
          id: typeof node.id === 'string' ? node.id : `node_${window.crypto.randomUUID()}`,
          name: typeof node.name === 'string' ? node.name : 'unnamed',
          type: node.type === 'folder' ? 'folder' as const : 'file' as const,
          content: typeof node.content === 'string' ? node.content : undefined,
          isOpen: typeof node.isOpen === 'boolean' ? node.isOpen : undefined,
          children: Array.isArray(node.children)
            ? cleanNodes(node.children as Record<string, unknown>[])
            : undefined
        }));
      };
      
      const parsedWorkspace = cleanNodes(data as Record<string, unknown>[]);
      setFileSystem(parsedWorkspace);
      
      const findFirstFile = (nodes: FileSystemNode[]): FileSystemNode | null => {
        for (const node of nodes) {
          if (node.type === 'file') return node;
          if (node.children) {
            const found = findFirstFile(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      
      const firstFile = findFirstFile(parsedWorkspace);
      if (firstFile) {
        setActiveFile({ name: firstFile.name, content: firstFile.content || '' });
      }
      
      setTerminalLogs(prev => [...prev, `✅ Workspace imported successfully!`]);
      setIsImporting(false);
    } catch (error) {
      setTerminalLogs(prev => [...prev, `❌ Error importing workspace`]);
      console.error('Import workspace error:', error);
    }
    
    event.target.value = '';
  };

  const renderTree = (nodes: FileSystemNode[]) => {
    return nodes.map((node) => (
      <div key={node.id} className="pl-2 my-1">
        {node.type === 'folder' ? (
          <div>
            <div
              onClick={(e) => { e.stopPropagation(); setSelectedFolderId(node.id); setFocusedNodeId(node.id); setFileSystem(toggleFolderOpenTree(fileSystem, node.id)); }}
              className={`flex items-center justify-between text-sm text-left w-full pl-2 py-1 rounded-md transition-all group outline-none touch-manipulation ${
                selectedFolderId === node.id 
                  ? 'bg-blue-600/10 border border-blue-500/30 text-zinc-200' 
                  : focusedNodeId === node.id
                  ? 'bg-zinc-800/80 border border-zinc-700 text-zinc-300'
                  : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center min-w-0">
                {node.isOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 mr-1 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 mr-1 shrink-0" />}
                {node.isOpen ? <FolderOpen className="w-4 h-4 text-amber-500 mr-2 shrink-0" /> : <Folder className="w-4 h-4 text-amber-500 mr-2 shrink-0" />}
                <span className="truncate">{node.name}</span>
              </div>
              <div className="flex items-center opacity-0 group-hover:opacity-100 space-x-1 pr-1 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); exportFolder(node); }} title="Export Folder" className="p-1 rounded text-zinc-500 hover:text-blue-400 hover:bg-zinc-800"><Download className="w-3 h-3" /></button>
                <button onClick={(e) => handleCopy(e, node)} title="Copy" className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800"><Copy className="w-3 h-3" /></button>
                <button onClick={(e) => handleCut(e, node)} title="Cut" className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800"><Scissors className="w-3 h-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); setFileSystem(prev => removeNodeTree(prev, node.id)); if (selectedFolderId === node.id) setSelectedFolderId(null); }} title="Delete" className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
            {node.isOpen && (
              <div className="border-l border-zinc-800 ml-3.5 pl-2">
                {node.children && renderTree(node.children)}
                {selectedFolderId === node.id && (isCreatingFile || isCreatingFolder) && (
                  <div className="flex items-center pl-2 my-1.5" onClick={(e) => e.stopPropagation()}>
                    {isCreatingFolder ? <Folder className="w-4 h-4 text-amber-500 mr-2 shrink-0" /> : <FileCode className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />}
                    <input
                      ref={inputRef}
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={handleInlineSubmit}
                      onBlur={cancelCreation}
                      placeholder={isCreatingFolder ? "subfolder..." : "script.py..."}
                      className="bg-zinc-900 border border-blue-500 text-xs rounded px-1.5 py-0.5 text-zinc-100 focus:outline-none w-full font-mono"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={(e) => { e.stopPropagation(); setFocusedNodeId(node.id); setActiveFile({ name: node.name, content: node.content || '' }); if (isMobile) setIsExplorerOpen(false); }}
            className={`flex items-center justify-between text-sm text-left w-full pl-6 py-1.5 rounded-md transition-all group outline-none touch-manipulation ${
              activeFile.name === node.name 
                ? 'bg-zinc-800 text-white font-medium border-l-2 border-blue-500 shadow-sm' 
                : focusedNodeId === node.id
                ? 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center min-w-0">
              <FileCode className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
              <span className="truncate">{node.name}</span>
            </div>
            <div className="flex items-center opacity-0 group-hover:opacity-100 space-x-1 pr-1 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); exportFile(node); }} title="Export File" className="p-1 rounded text-zinc-500 hover:text-blue-400 hover:bg-zinc-800"><Download className="w-3 h-3" /></button>
              <button onClick={(e) => handleCopy(e, node)} title="Copy" className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800"><Copy className="w-3 h-3" /></button>
              <button onClick={(e) => handleCut(e, node)} title="Cut" className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800"><Scissors className="w-3 h-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); setFileSystem(prev => removeNodeTree(prev, node.id)); }} title="Delete" className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans selection:bg-blue-500/30">
      
      {/* Header - Mobile Optimized */}
      <header className="px-3 sm:px-6 py-2 sm:py-3 bg-zinc-900/50 backdrop-blur border-b border-zinc-800 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button 
            onClick={() => setIsExplorerOpen(!isExplorerOpen)}
            className="md:hidden p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 shrink-0">D</div>
          <span className="font-semibold text-xs sm:text-sm tracking-tight truncate">Destora IDE</span>
          <span className="text-[10px] px-1.5 sm:px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono border border-zinc-700 truncate max-w-20 sm:max-w-none">
            {activeFile.name}
          </span>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2">
          <div className="relative">
            <button 
              onClick={() => setIsImporting(!isImporting)}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              title="Import/Export"
            >
              <Import className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            {isImporting && (
              <div className="absolute right-0 top-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-2 w-52 z-50">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 rounded transition text-zinc-300"
                >
                  Import File
                </button>
                <button 
                  onClick={() => folderInputRef.current?.click()}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 rounded transition text-zinc-300"
                >
                  Import Folder
                </button>
                <button 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.onchange = (e) => {
                      if (e.target) {
                        importWorkspace(e as unknown as React.ChangeEvent<HTMLInputElement>);
                      }
                    };
                    input.click();
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 rounded transition text-zinc-300"
                >
                  Import Workspace
                </button>
                <button 
                  onClick={() => {
                    const name = prompt('Enter folder name:');
                    if (name && name.trim()) {
                      const newFolderNode: FileSystemNode = {
                        id: `node_${window.crypto.randomUUID()}`,
                        name: name.trim(),
                        type: 'folder',
                        isOpen: true,
                        children: []
                      };
                      if (selectedFolderId) {
                        setFileSystem(insertNodeTree(fileSystem, selectedFolderId, newFolderNode));
                      } else {
                        setFileSystem([...fileSystem, newFolderNode]);
                      }
                      setTerminalLogs(prev => [...prev, `✅ Created empty folder: ${name.trim()}`]);
                    }
                    setIsImporting(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 rounded transition text-zinc-300 border-t border-zinc-800 mt-1"
                >
                  Create Empty Folder
                </button>
                <div className="border-t border-zinc-800 my-1"></div>
                <button 
                  onClick={exportWorkspace}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 rounded transition text-blue-400"
                >
                  Export Workspace
                </button>
                <button 
                  onClick={() => setIsImporting(false)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 rounded transition text-zinc-500 mt-1"
                >
                  Close
                </button>
              </div>
            )}
          </div>
          <button 
            onClick={handleRun} 
            disabled={loading} 
            className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden xs:inline">Run</span>
          </button>
        </div>
      </header>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={importFile}
        accept=".py,.txt,.js,.jsx,.ts,.tsx,.html,.css,.json,.md"
      />
                     <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        onChange={importFolder}
        multiple
        {...{
          webkitdirectory: "",
          directory: "",
          mozdirectory: ""
        }}
      />

      {/* Mobile Explorer */}
      <MobileExplorer
        isExplorerOpen={isExplorerOpen}
        setIsExplorerOpen={setIsExplorerOpen}
        explorerRef={explorerRef}
        fileSystem={fileSystem}
        renderTree={renderTree}
        getTargetNodeName={getTargetNodeName}
        selectedFolderId={selectedFolderId}
        internalClipboard={internalClipboard}
        handlePaste={handlePaste}
        isCreatingFile={isCreatingFile}
        isCreatingFolder={isCreatingFolder}
        setIsCreatingFile={setIsCreatingFile}
        setIsCreatingFolder={setIsCreatingFolder}
        newItemName={newItemName}
        setNewItemName={setNewItemName}
        handleInlineSubmit={handleInlineSubmit}
        cancelCreation={cancelCreation}
        inputRef={inputRef}
      />
      <ExplorerToggleButton setIsExplorerOpen={setIsExplorerOpen} />

      {/* Main Content - Mobile First */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl w-full mx-auto">
        
        {/* Desktop Sidebar - Hidden on mobile */}
        <aside className="hidden md:flex w-64 bg-zinc-900/20 border-r border-zinc-800 p-4 flex-col shrink-0">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-900">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">File Explorer</span>
                <span className="text-[9px] text-blue-400 font-mono font-medium truncate max-w-35">
                  Target: /{getTargetNodeName(selectedFolderId)}
                </span>
              </div>
              <div className="flex items-center space-x-0.5">
                {internalClipboard && (
                  <button onClick={handlePaste} className="p-1.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600 transition mr-1"><Clipboard className="w-3.5 h-3.5" /></button>
                )}
                <button onClick={(e) => { e.stopPropagation(); setIsCreatingFolder(false); setIsCreatingFile(true); }} className="p-1.5 rounded hover:bg-zinc-900 text-zinc-400 hover:text-white transition"><FilePlus className="w-3.5 h-3.5" /></button>
                <button onClick={(e) => { e.stopPropagation(); setIsCreatingFile(false); setIsCreatingFolder(true); }} className="p-1.5 rounded hover:bg-zinc-900 text-zinc-400 hover:text-white transition"><FolderPlus className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto font-mono custom-scrollbar pr-1">
              {renderTree(fileSystem)}
              {!selectedFolderId && (isCreatingFile || isCreatingFolder) && (
                <div className="flex items-center pl-2 my-2">
                  <input ref={inputRef} type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={handleInlineSubmit} onBlur={cancelCreation} placeholder={isCreatingFolder ? "New folder..." : "New file.py..."} className="bg-zinc-900 border border-blue-500 text-xs rounded px-1.5 py-0.5 text-zinc-100 focus:outline-none w-full font-mono" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 border border-zinc-800/80 bg-zinc-900/30 p-3 rounded-xl space-y-2 shrink-0">
            <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-blue-400 shrink-0" />
              <span>Shell Guide</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-normal font-mono">
              ls • mkdir test<br />
              touch main.py • python main.py
            </p>
          </div>
        </aside>

        {/* Code Canvas - Full width on mobile */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-[50vh] md:min-h-0">
          <div className="flex-1 flex flex-col p-2 sm:p-4 relative">
            <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono mb-2 bg-zinc-900/30 p-2 rounded-md border border-zinc-800/50">
              <span className="flex items-center truncate">
                <Monitor className="w-3 h-3 mr-1.5 text-blue-500 shrink-0" />
                <span className="hidden xs:inline">Code Editor</span>
                <span className="xs:hidden">Editor</span>
              </span>
              <span className="text-zinc-400">Python 3.11</span>
            </div>
            <textarea 
              value={activeFile.content} 
              onChange={handleEditorChange} 
              className="w-full flex-1 p-3 sm:p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500/80 resize-none text-zinc-100 leading-relaxed shadow-lg min-h-50"
              spellCheck="false"
              style={{ WebkitOverflowScrolling: 'touch' }}
            />
          </div>

          {/* Terminal - Compact on mobile */}
          <div className="h-48 sm:h-56 md:h-64 bg-zinc-950 p-2 sm:p-4 font-mono text-xs flex flex-col border-t border-zinc-900">
            <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2 select-none">
              <span className="flex items-center">
                <Terminal className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                <span className="hidden xs:inline">Terminal</span>
              </span>
              <span className="text-zinc-600 text-[9px] font-normal lowercase">Console</span>
            </div>
            <div className="flex-1 overflow-y-auto bg-zinc-900/30 border border-zinc-900 rounded-xl p-3 sm:p-4 text-zinc-300 shadow-inner custom-scrollbar space-y-1">
              {terminalLogs.slice(-20).map((log, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed text-[10px] sm:text-xs">{log}</div>
              ))}
              <div ref={consoleBottomRef} />
            </div>
            <form onSubmit={handleTerminalSubmit} className="flex items-center mt-2 bg-zinc-900/50 border border-zinc-800 rounded-lg px-2 sm:px-3 py-1 focus-within:border-emerald-500/50 transition">
              <span className="text-emerald-500 font-bold mr-1.5 sm:mr-2 select-none text-[10px] sm:text-xs">~#</span>
              <input 
                type="text" 
                value={terminalInput} 
                onChange={(e) => setTerminalInput(e.target.value)} 
                placeholder="Type command..." 
                className="bg-transparent text-zinc-200 outline-none w-full font-mono text-[10px] sm:text-xs placeholder:text-zinc-600" 
              />
            </form>
          </div>
        </div>
      </div>

      {/* Add custom CSS for mobile touch improvements */}
      <style>{`
        .touch-manipulation {
          touch-action: manipulation;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 2px;
        }
        @media (max-width: 480px) {
          .custom-scrollbar::-webkit-scrollbar {
            width: 2px;
          }
        }
      `}</style>
    </div>
  );
}