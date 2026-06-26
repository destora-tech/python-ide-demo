'use client';
import { useState, useRef, useEffect } from 'react';
import { Folder, FolderOpen, FileCode, Play, Monitor, Terminal, FilePlus, FolderPlus, ChevronDown, ChevronRight, Copy, Scissors, Clipboard, Upload, Trash2, HelpCircle } from 'lucide-react';

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

// Search for a file node by name in the active folder or root level
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
  
  const inputRef = useRef<HTMLInputElement>(null);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

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

  // --- INTERACTIVE TERMINAL ROUTING WITH PYTHON SUPPORT ---
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

      // VIRTUAL INTERPRETATION LAYER FOR PYTHON CALL RUNNERS
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

  const renderTree = (nodes: FileSystemNode[]) => {
    return nodes.map((node) => (
      <div key={node.id} className="pl-2 my-1">
        {node.type === 'folder' ? (
          <div>
            <div
              onClick={(e) => { e.stopPropagation(); setSelectedFolderId(node.id); setFocusedNodeId(node.id); setFileSystem(toggleFolderOpenTree(fileSystem, node.id)); }}
              className={`flex items-center justify-between text-sm text-left w-full pl-2 py-1 rounded-md transition-all group outline-none ${
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
            onClick={(e) => { e.stopPropagation(); setFocusedNodeId(node.id); setActiveFile({ name: node.name, content: node.content || '' }); }}
            className={`flex items-center justify-between text-sm text-left w-full pl-6 py-1.5 rounded-md transition-all group outline-none ${
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
      
      {/* Header Panel View */}
      <header className="px-6 py-3 bg-zinc-900/50 backdrop-blur border-b border-zinc-800 flex justify-between items-center top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm shadow-md shadow-blue-600/20">D</div>
          <span className="font-semibold text-sm tracking-tight hidden sm:inline-block">Destora IDE Training Center</span>
          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono border border-zinc-700">{activeFile.name}</span>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={handleRun} disabled={loading} className="flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-md active:scale-95">
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Module</span>
          </button>
        </div>
      </header>

      {/* Primary Dashboard Panes */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl w-full mx-auto">
        
        {/* Sidebar Workspace Area */}
        <aside onClick={() => { setSelectedFolderId(null); setFocusedNodeId(null); }} className="w-full md:w-64 bg-zinc-900/20 md:border-r border-b md:border-b-0 border-zinc-800 p-4 flex flex-col shrink-0 cursor-pointer justify-between">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-900 cursor-default" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">File Explorer</span>
                <span className="text-[9px] text-blue-400 font-mono font-medium truncate max-w-[140px]">
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
            
            <div className="flex-1 overflow-y-auto font-mono custom-scrollbar pr-1 max-h-48 md:max-h-none cursor-default" onClick={(e) => e.stopPropagation()}>
              {renderTree(fileSystem)}
              {!selectedFolderId && (isCreatingFile || isCreatingFolder) && (
                <div className="flex items-center pl-2 my-2">
                  <input ref={inputRef} type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={handleInlineSubmit} onBlur={cancelCreation} placeholder={isCreatingFolder ? "New folder..." : "New file.py..."} className="bg-zinc-900 border border-blue-500 text-xs rounded px-1.5 py-0.5 text-zinc-100 focus:outline-none w-full font-mono" />
                </div>
              )}
            </div>
          </div>

          {/* TRAINING WIZARD HINTS PANEL */}
          <div className="mt-4 border border-zinc-800/80 bg-zinc-900/30 p-3 rounded-xl cursor-default space-y-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-blue-400 shrink-0" />
              <span>Student Shell Guide</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-normal font-mono">
              Try teaching commands:<br />
              • ls : Show folder content items<br />
              • mkdir test : Make a directory<br />
              • touch main.py : Make a python script<br />
              • python main.py : Run your python script
            </p>
          </div>
        </aside>

        {/* Code Canvas Display Framework Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-96 md:min-h-0">
          <div className="flex-1 flex flex-col p-4 relative min-h-64 md:min-h-0">
            <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono mb-2 bg-zinc-900/30 p-2 rounded-md border border-zinc-800/50">
              <span className="flex items-center"><Monitor className="w-3 h-3 mr-1.5 text-blue-500" /> Source Canvas Code Editor</span>
              <span className="text-zinc-400">Python 3.11</span>
            </div>
            <textarea value={activeFile.content} onChange={handleEditorChange} className="w-full flex-1 p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-500/80 resize-none text-zinc-100 leading-relaxed shadow-lg" spellCheck="false" />
          </div>

          {/* Fully Functional Terminal Module Layout */}
          <div className="h-60 md:h-64 bg-zinc-950 p-4 font-mono text-xs flex flex-col border-t border-zinc-900">
            <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2 select-none">
              <span className="flex items-center"><Terminal className="w-3.5 h-3.5 mr-2 text-emerald-500" /> Interactive Terminal Shell Emulator</span>
              <span className="text-zinc-600 text-[9px] font-normal lowercase">Sandbox Console Environment</span>
            </div>
            <div className="flex-1 overflow-y-auto bg-zinc-900/30 border border-zinc-900 rounded-xl p-4 text-zinc-300 shadow-inner custom-scrollbar space-y-1">
              {terminalLogs.map((log, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed">{log}</div>
              ))}
              <div ref={consoleBottomRef} />
            </div>
            <form onSubmit={handleTerminalSubmit} className="flex items-center mt-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-1.5 focus-within:border-emerald-500/50 transition">
              <span className="text-emerald-500 font-bold mr-2 select-none">pymobile:~#</span>
              <input type="text" value={terminalInput} onChange={(e) => setTerminalInput(e.target.value)} placeholder="Type commands here (e.g., ls, python main.py)..." className="bg-transparent text-zinc-200 outline-none w-full font-mono text-xs placeholder:text-zinc-600" />
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}