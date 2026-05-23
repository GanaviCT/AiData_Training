import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchTasksStart, fetchTasksSuccess, fetchTasksFailure, setActiveTask } from '../store/taskSlice';
import { API_BASE_URL } from '../config';
import { 
  Play, 
  Plus, 
  FileJson, 
  Tag, 
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Check,
  ChevronDown,
  HelpCircle,
  User,
  Users,
  Upload,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';


interface TaskManagementProps {
  setActivePage: (page: string) => void;
}

const TaskManagement: React.FC<TaskManagementProps> = ({ setActivePage }) => {
  const dispatch = useDispatch();
  const { token, user } = useSelector((state: RootState) => state.auth);
  const { tasks, loading } = useSelector((state: RootState) => state.tasks);
  
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;
  
  // Modals / Panels
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<'single' | 'json' | 'csv'>('single');
  const isBulk = bulkMode !== 'single';
  const [csvTasks, setCsvTasks] = useState<any[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>('');

  
  // Single task form
  const [taskType, setTaskType] = useState('text');
  const [taskData, setTaskData] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskAssignedTo, setTaskAssignedTo] = useState('');
  const [taskAssigneeEmail, setTaskAssigneeEmail] = useState('');
  
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{ 
    taskId: number; 
    taskType: string;
    taskData: string;
    userIdStr: string; 
    username: string; 
    userRole: string; 
  } | null>(null);
  const [emailInput, setEmailInput] = useState('');
  
  // Bulk upload form
  const [bulkJson, setBulkJson] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // loading guards to prevent double-clicks/duplicate API calls
  const [startingTaskId, setStartingTaskId] = useState<number | null>(null);
  const [submittingTask, setSubmittingTask] = useState(false);

  // User list for Admin assignment
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Collapsible bulk batch states
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  
  // Bulk creation assignment states
  const [bulkAssignType, setBulkAssignType] = useState<'unassigned' | 'single' | 'distribute'>('unassigned');
  const [bulkSingleAssignee, setBulkSingleAssignee] = useState('');
  const [bulkSingleAssigneeEmail, setBulkSingleAssigneeEmail] = useState('');
  const [bulkSelectedUsers, setBulkSelectedUsers] = useState<number[]>([]);

  // Post-upload batch assignment modal states
  const [batchAssignModal, setBatchAssignModal] = useState<{
    batchId: string;
    tasks: any[];
  } | null>(null);
  const [batchAssignTypeModal, setBatchAssignTypeModal] = useState<'unassigned' | 'single' | 'distribute'>('unassigned');
  const [batchSingleAssigneeModal, setBatchSingleAssigneeModal] = useState('');
  const [batchSingleAssigneeEmailModal, setBatchSingleAssigneeEmailModal] = useState('');
  const [batchSelectedUsersModal, setBatchSelectedUsersModal] = useState<number[]>([]);
  const [isUpdatingBatch, setIsUpdatingBatch] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' && token) {
      fetchUsers();
    }
  }, [user, token]);

  const handleAssignTask = async (taskId: number, userIdStr: string, email?: string) => {
    const userId = userIdStr ? parseInt(userIdStr, 10) : null;
    const targetUser = allUsers.find(u => u.id === userId);
    
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assigned_to_id: userId,
          status: userId ? 'in-progress' : 'pending',
          assignee_email: email || null
        })
      });

      if (response.ok) {
        showToast(
          userId 
            ? `Task #00${taskId} successfully assigned to @${targetUser?.username}! Email dispatched to ${email || (targetUser?.username + '@example.com')}.`
            : `Task #00${taskId} is now unassigned.`,
          'success'
        );
        fetchTasks();
        window.dispatchEvent(new CustomEvent('qa-count-updated'));
      } else {
        showToast("Failed to assign task.", "error");
      }
    } catch (err) {
      console.error("Error assigning task:", err);
      showToast("An error occurred during assignment.", "error");
    }
  };

  const handleApplyBatchAssignment = async () => {
    if (!batchAssignModal) return;
    setIsUpdatingBatch(true);
    try {
      const { tasks: batchTasks } = batchAssignModal;
      let updates: any[] = [];
      
      if (batchAssignTypeModal === 'single') {
        if (!batchSingleAssigneeModal) {
          showToast("Please select a user.", "error");
          setIsUpdatingBatch(false);
          return;
        }
        const targetUser = allUsers.find(u => u.id === parseInt(batchSingleAssigneeModal, 10));
        const email = batchSingleAssigneeEmailModal || targetUser?.email || `${targetUser?.username}@example.com`;
        updates = batchTasks.map(t => ({
          taskId: t.id,
          assignedToId: targetUser.id,
          status: 'in-progress',
          email
        }));
      } else if (batchAssignTypeModal === 'distribute') {
        if (batchSelectedUsersModal.length === 0) {
          showToast("Please select at least one user.", "error");
          setIsUpdatingBatch(false);
          return;
        }
        updates = batchTasks.map((t, index) => {
          const userId = batchSelectedUsersModal[index % batchSelectedUsersModal.length];
          const targetUser = allUsers.find(u => u.id === userId);
          const email = targetUser?.email || `${targetUser?.username}@example.com`;
          return {
            taskId: t.id,
            assignedToId: userId,
            status: 'in-progress',
            email
          };
        });
      } else {
        // Unassigned
        updates = batchTasks.map(t => ({
          taskId: t.id,
          assignedToId: null,
          status: 'pending',
          email: null
        }));
      }

      // Update tasks in parallel
      await Promise.all(
        updates.map(u => 
          fetch(`${API_BASE_URL}/tasks/${u.taskId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              assigned_to_id: u.assignedToId,
              status: u.status,
              assignee_email: u.email
            })
          })
        )
      );

      showToast(`Successfully updated assignment for ${batchTasks.length} tasks!`, "success");
      setBatchAssignModal(null);
      setBatchAssignTypeModal('unassigned');
      setBatchSingleAssigneeModal('');
      setBatchSingleAssigneeEmailModal('');
      setBatchSelectedUsersModal([]);
      fetchTasks();
      window.dispatchEvent(new CustomEvent('qa-count-updated'));
    } catch (err: any) {
      console.error("Failed to update batch assignment:", err);
      showToast("An error occurred while updating assignments.", "error");
    } finally {
      setIsUpdatingBatch(false);
    }
  };

  const fetchTasks = async () => {
    dispatch(fetchTasksStart());
    try {
      let url = `${API_BASE_URL}/tasks`;
      const params = [];
      if (statusFilter) params.push(`status=${statusFilter}`);
      if (typeFilter) params.push(`type=${typeFilter}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to load tasks");
      const data = await response.json();
      dispatch(fetchTasksSuccess(data));
    } catch (err: any) {
      dispatch(fetchTasksFailure(err.message));
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, typeFilter, token]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, sourceFilter]);

  const handleStartTask = async (task: any) => {
    if (startingTaskId !== null) return;

    // If pending/rejected, self-assign and change status to 'in-progress'
    if (task.status === 'pending' || task.status === 'rejected') {
      setStartingTaskId(task.id);
      try {
        const response = await fetch(`${API_BASE_URL}/tasks/${task.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            status: 'in-progress',
            assigned_to_id: user?.id
          })
        });
        if (response.ok) {
          const updatedTask = await response.json();
          dispatch(setActiveTask(updatedTask));
          setActivePage('annotation');
        }
      } catch (err) {
        console.error("Error self-assigning task:", err);
      } finally {
        setStartingTaskId(null);
      }
    } else {
      dispatch(setActiveTask(task));
      setActivePage('annotation');
    }
  };

  const splitCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = splitCSVLine(lines[0]).map(h => h.trim().replace(/^["']|["']$/g, ''));
    const parsedRows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = splitCSVLine(lines[i]).map(v => v.trim().replace(/^["']|["']$/g, ''));
      const rowObj: any = {};
      headers.forEach((header, index) => {
        rowObj[header] = values[index] !== undefined ? values[index] : '';
      });
      parsedRows.push(rowObj);
    }
    return parsedRows;
  };

  const processParsedRow = (row: any) => {
    let dataVal = '';
    let typeVal = '';
    let priorityVal = 'medium';

    const normalizedRow: { [key: string]: any } = {};
    Object.keys(row).forEach(key => {
      normalizedRow[key.toLowerCase().trim()] = row[key];
    });

    const dataKeys = ['data', 'text_passage', 'textpassage', 'text', 'image_url', 'imageurl', 'url', 'payload', 'content', 'passage'];
    for (const k of dataKeys) {
      if (normalizedRow[k] !== undefined && normalizedRow[k] !== null) {
        dataVal = String(normalizedRow[k]).trim();
        break;
      }
    }

    const priorityKeys = ['priority', 'task_priority', 'priority_level', 'prioritylevel'];
    for (const k of priorityKeys) {
      if (normalizedRow[k] !== undefined && normalizedRow[k] !== null) {
        const p = String(normalizedRow[k]).toLowerCase().trim();
        if (['low', 'medium', 'high'].includes(p)) {
          priorityVal = p;
        }
        break;
      }
    }

    const typeKeys = ['type', 'task_type', 'tasktype'];
    for (const k of typeKeys) {
      if (normalizedRow[k] !== undefined && normalizedRow[k] !== null) {
        const t = String(normalizedRow[k]).toLowerCase().trim();
        if (['text', 'image'].includes(t)) {
          typeVal = t;
        }
        break;
      }
    }

    if (!typeVal) {
      const isUrl = /^(https?:\/\/)/i.test(dataVal);
      const hasImageExt = /\.(png|jpe?g|gif|webp|bmp|tiff)$/i.test(dataVal);
      if (isUrl || hasImageExt) {
        typeVal = 'image';
      } else {
        typeVal = 'text';
      }
    }

    return {
      type: typeVal,
      data: dataVal,
      priority: priorityVal,
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setFormError(null);

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    const reader = new FileReader();
    if (fileExtension === 'csv') {
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          const rawRows = parseCSV(text);
          if (!rawRows || rawRows.length === 0) {
            throw new Error("No data found or file is empty");
          }
          const processed = rawRows.map(row => processParsedRow(row)).filter(t => t.data);
          if (processed.length === 0) {
            throw new Error("No tasks parsed. Ensure columns are correctly named.");
          }
          setCsvTasks(processed);
        } catch (err: any) {
          setFormError(err.message || "Failed to parse CSV file");
          setCsvTasks([]);
        }
      };
      reader.readAsText(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet);
          if (!rawRows || rawRows.length === 0) {
            throw new Error("No data found or file is empty");
          }
          const processed = rawRows.map(row => processParsedRow(row)).filter(t => t.data);
          if (processed.length === 0) {
            throw new Error("No tasks parsed. Ensure columns are correctly named.");
          }
          setCsvTasks(processed);
        } catch (err: any) {
          setFormError(err.message || "Failed to parse Excel file");
          setCsvTasks([]);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setFormError("Unsupported file type. Please upload .csv, .xlsx, or .xls files.");
      setCsvTasks([]);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingTask) return;
    setFormError(null);
    setSubmittingTask(true);

    if (bulkMode === 'json') {
      try {
        const parsed = JSON.parse(bulkJson);
        if (!Array.isArray(parsed)) throw new Error("JSON must be a list of tasks");

        // Validate bulk assignment
        if (bulkAssignType === 'single' && !bulkSingleAssignee) {
          throw new Error("Please select a user for bulk assignment.");
        }
        if (bulkAssignType === 'distribute' && bulkSelectedUsers.length === 0) {
          throw new Error("Please select at least one user to distribute tasks to.");
        }

        const batchId = `bulk_batch_${Date.now()}`;
        const enriched = parsed.map((task: any, index: number) => {
          const item = { ...task, import_source: batchId };
          if (bulkAssignType === 'single') {
            item.assigned_to_id = parseInt(bulkSingleAssignee, 10);
            item.status = 'in-progress';
            item.assignee_email = bulkSingleAssigneeEmail;
          } else if (bulkAssignType === 'distribute') {
            const userId = bulkSelectedUsers[index % bulkSelectedUsers.length];
            const userObj = allUsers.find(u => u.id === userId);
            item.assigned_to_id = userId;
            item.status = 'in-progress';
            item.assignee_email = userObj?.email || `${userObj?.username}@example.com`;
          } else {
            item.assigned_to_id = null;
            item.status = 'pending';
            item.assignee_email = null;
          }
          return item;
        });
        
        const response = await fetch(`${API_BASE_URL}/tasks/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(enriched)
        });

        if (!response.ok) throw new Error("Bulk upload failed");
        
        setShowCreateModal(false);
        setBulkJson('');
        setBulkAssignType('unassigned');
        setBulkSingleAssignee('');
        setBulkSingleAssigneeEmail('');
        setBulkSelectedUsers([]);
        showToast("Bulk tasks successfully imported!", "success");
        fetchTasks();
      } catch (err: any) {
        setFormError(err.message || "Invalid JSON syntax");
      } finally {
        setSubmittingTask(false);
      }
    } else if (bulkMode === 'csv') {
      try {
        if (csvTasks.length === 0) {
          throw new Error("No tasks loaded. Please upload a CSV or Excel file first.");
        }

        // Validate bulk assignment
        if (bulkAssignType === 'single' && !bulkSingleAssignee) {
          throw new Error("Please select a user for bulk assignment.");
        }
        if (bulkAssignType === 'distribute' && bulkSelectedUsers.length === 0) {
          throw new Error("Please select at least one user to distribute tasks to.");
        }

        const batchId = `bulk_batch_${Date.now()}`;
        const enriched = csvTasks.map((task: any, index: number) => {
          const item = { ...task, import_source: batchId };
          if (bulkAssignType === 'single') {
            item.assigned_to_id = parseInt(bulkSingleAssignee, 10);
            item.status = 'in-progress';
            item.assignee_email = bulkSingleAssigneeEmail;
          } else if (bulkAssignType === 'distribute') {
            const userId = bulkSelectedUsers[index % bulkSelectedUsers.length];
            const userObj = allUsers.find(u => u.id === userId);
            item.assigned_to_id = userId;
            item.status = 'in-progress';
            item.assignee_email = userObj?.email || `${userObj?.username}@example.com`;
          } else {
            item.assigned_to_id = null;
            item.status = 'pending';
            item.assignee_email = null;
          }
          return item;
        });
        
        const response = await fetch(`${API_BASE_URL}/tasks/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(enriched)
        });

        if (!response.ok) throw new Error("Bulk CSV upload failed");
        
        setShowCreateModal(false);
        setCsvTasks([]);
        setCsvFileName('');
        setBulkAssignType('unassigned');
        setBulkSingleAssignee('');
        setBulkSingleAssigneeEmail('');
        setBulkSelectedUsers([]);
        showToast(`Successfully imported ${csvTasks.length} tasks from spreadsheet!`, "success");
        fetchTasks();
      } catch (err: any) {
        setFormError(err.message || "Failed to submit bulk tasks");
      } finally {
        setSubmittingTask(false);
      }
    } else {
      if (!taskData) {
        setSubmittingTask(false);
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            type: taskType,
            data: taskData,
            priority: taskPriority,
            assigned_to_id: taskAssignedTo ? parseInt(taskAssignedTo, 10) : null,
            status: taskAssignedTo ? 'in-progress' : 'pending',
            assignee_email: taskAssignedTo ? taskAssigneeEmail : null
          })
        });

        if (!response.ok) throw new Error("Task creation failed");
        
        const createdTask = await response.json();
        setShowCreateModal(false);
        setTaskData('');
        
        const assignedUsername = allUsers.find(u => u.id === parseInt(taskAssignedTo, 10))?.username;
        if (assignedUsername) {
          showToast(`Task #00${createdTask.id} created & assigned to @${assignedUsername}! Email dispatched to ${taskAssigneeEmail}.`, 'success');
        } else {
          showToast(`Task #00${createdTask.id} successfully created!`, 'success');
        }
        
        setTaskAssignedTo('');
        setTaskAssigneeEmail('');
        fetchTasks();
      } catch (err: any) {
        setFormError(err.message);
      } finally {
        setSubmittingTask(false);
      }
    }
  };

  // Filter tasks based on selected filter options
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = !statusFilter || task.status === statusFilter;
    const matchesType = !typeFilter || task.type === typeFilter;
    const taskSource = task.import_source || 'single';
    const matchesSource = !sourceFilter || 
      (sourceFilter === 'bulk'
        ? (taskSource === 'bulk' || taskSource.startsWith('bulk_batch_'))
        : taskSource === sourceFilter);
    return matchesStatus && matchesType && matchesSource;
  });

  // Group tasks by single vs bulk batch
  const singleTasks: any[] = [];
  const batchMap: Record<string, any[]> = {};

  // Sort filteredTasks by ID ascending first to identify contiguous sequences
  const sortedFilteredTasks = [...filteredTasks].sort((a, b) => a.id - b.id);

  let legacyBatchCounter = 1;
  let currentLegacyBatchTasks: any[] = [];
  let lastLegacyId: number | null = null;

  sortedFilteredTasks.forEach(task => {
    const isBulk = task.import_source && (task.import_source === 'bulk' || task.import_source.startsWith('bulk_batch_'));
    if (isBulk) {
      if (task.import_source.startsWith('bulk_batch_')) {
        const bId = task.import_source;
        if (!batchMap[bId]) batchMap[bId] = [];
        batchMap[bId].push(task);
      } else {
        // Legacy "bulk" tasks: group by contiguous IDs (max difference of 3)
        if (lastLegacyId !== null && task.id - lastLegacyId > 3) {
          if (currentLegacyBatchTasks.length > 0) {
            const bId = `legacy_batch_${legacyBatchCounter}`;
            batchMap[bId] = currentLegacyBatchTasks;
            legacyBatchCounter++;
            currentLegacyBatchTasks = [];
          }
        }
        currentLegacyBatchTasks.push(task);
        lastLegacyId = task.id;
      }
    } else {
      singleTasks.push(task);
    }
  });

  if (currentLegacyBatchTasks.length > 0) {
    const bId = `legacy_batch_${legacyBatchCounter}`;
    batchMap[bId] = currentLegacyBatchTasks;
  }

  // Collapsible batch formatting utility
  const formatBatchName = (batchId: string) => {
    if (batchId === 'bulk') return 'General Bulk Upload';
    if (batchId.startsWith('legacy_batch_')) {
      const bTasks = batchMap[batchId] || [];
      if (bTasks.length > 0) {
        const ids = bTasks.map(t => t.id);
        const minId = Math.min(...ids);
        const maxId = Math.max(...ids);
        return `Bulk Batch: #00${minId} - #00${maxId}`;
      }
      return 'Bulk Batch';
    }
    if (batchId.startsWith('bulk_batch_')) {
      const tsStr = batchId.replace('bulk_batch_', '');
      const ts = parseInt(tsStr, 10);
      if (!isNaN(ts)) {
        const d = new Date(ts);
        return `Batch: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
    }
    return `Batch: ${batchId}`;
  };

  // Build list of sortable groups
  interface SortGroup {
    type: 'single' | 'batch';
    sortId: number;
    task?: any;
    batchId?: string;
    tasks?: any[];
  }

  const groups: SortGroup[] = [];
  singleTasks.forEach(t => {
    groups.push({ type: 'single', sortId: t.id, task: t });
  });
  Object.entries(batchMap).forEach(([bId, bTasks]) => {
    const maxId = Math.max(...bTasks.map(t => t.id));
    groups.push({ type: 'batch', sortId: maxId, batchId: bId, tasks: bTasks });
  });

  // Sort groups descending by sortId
  groups.sort((a, b) => b.sortId - a.sortId);

  // Paginate groups
  const totalItems = groups.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGroups = groups.slice(startIndex, endIndex);

  // Flatten groups into display table items based on collapse states
  interface TableItem {
    type: 'single' | 'batch' | 'batch-child';
    id: string;
    task?: any;
    batchId?: string;
    batchTasks?: any[];
  }

  const tableItems: TableItem[] = [];
  paginatedGroups.forEach(g => {
    if (g.type === 'single') {
      tableItems.push({
        type: 'single',
        id: `single-${g.task.id}`,
        task: g.task
      });
    } else {
      const batchId = g.batchId!;
      const isExpanded = !!expandedBatches[batchId];
      tableItems.push({
        type: 'batch',
        id: `batch-${batchId}`,
        batchId,
        batchTasks: g.tasks
      });
      if (isExpanded) {
        // Child tasks sorted descending by ID
        const sortedChildren = [...g.tasks!].sort((a, b) => b.id - a.id);
        sortedChildren.forEach(t => {
          tableItems.push({
            type: 'batch-child',
            id: `child-${t.id}`,
            task: t,
            batchId
          });
        });
      }
    }
  });

  return (
    <div className="p-8 space-y-6 relative">
      {/* Header and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="">All Types</option>
            <option value="text">Text Classification</option>
            <option value="image">Image Labeling</option>
            <option value="video">Video Labeling</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="">All Sources</option>
            <option value="bulk">Bulk Uploads</option>
            <option value="single">Single Tasks</option>
          </select>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-500/10 active:scale-95 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Create Task / Bulk Upload
          </button>
        )}
      </div>

      {/* Queue List */}
      <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No tasks match criteria.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/40 text-[10px] tracking-wider font-bold uppercase text-slate-400 border-b border-slate-800/85">
                <tr>
                  <th className="px-4 py-2.5 w-20">Task ID</th>
                  <th className="px-4 py-2.5 w-24">Type</th>
                  <th className="px-4 py-2.5">Payload Preview</th>
                  <th className="px-4 py-2.5 w-24">Priority</th>
                  <th className="px-4 py-2.5 w-24">Cost</th>
                  <th className="px-4 py-2.5 w-28">Status</th>
                  <th className="px-4 py-2.5 w-40">Assignee</th>
                  <th className="px-4 py-2.5 w-32 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {tableItems.map((item) => {
                  if (item.type === 'single') {
                    const task = item.task!;
                    return (
                      <tr 
                        key={item.id} 
                        className="hover:bg-slate-900/15 transition-all duration-150 border-b border-slate-850/50"
                      >
                        <td className="px-4 py-2.5 transition-all duration-150 border-l-4 border-l-transparent">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-white">#00{task.id}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md w-max uppercase tracking-wider flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/25 text-cyan-400">
                              <Tag className="w-2.5 h-2.5" />
                              Single
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5 capitalize text-xs">
                            <Tag className="w-3.5 h-3.5 text-cyan-400" />
                            {task.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">
                          <div className="max-w-[360px] truncate flex items-center gap-1.5" title={task.data}>
                            <span>{task.data}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            task.priority === 'high' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                            task.priority === 'medium' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                            'bg-slate-500/10 border-slate-500/30 text-slate-400'
                          }`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-white font-medium">${task.cost.toFixed(2)}</td>
                        <td className="px-4 py-2.5">
                          {(() => {
                            const latestAnnotation = task.annotations && task.annotations.length > 0
                              ? task.annotations[task.annotations.length - 1]
                              : null;
                            const qaResult = latestAnnotation?.qa_results && latestAnnotation.qa_results.length > 0
                              ? latestAnnotation.qa_results[latestAnnotation.qa_results.length - 1]
                              : null;

                            if (task.status === 'completed') {
                              if (qaResult?.approved === true) {
                                return <span className="capitalize text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-450 border border-emerald-500/25 whitespace-nowrap">Approved</span>;
                              }
                              return <span className="capitalize text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 whitespace-nowrap">Awaiting QA</span>;
                            }
                            
                            return (
                              <span className={`capitalize text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                task.status === 'in-progress' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                task.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                              }`}>
                                {task.status.replace('-', ' ')}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {user?.role === 'admin' && task.status !== 'completed' ? (
                            <div className="relative inline-block w-32">
                              <select
                                value={task.assigned_to_id || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    const targetUser = allUsers.find(u => u.id === parseInt(val, 10));
                                    if (targetUser) {
                                      setConfirmModal({
                                        taskId: task.id,
                                        taskType: task.type,
                                        taskData: task.data,
                                        userIdStr: val,
                                        username: targetUser.username,
                                        userRole: targetUser.role
                                      });
                                      setEmailInput(targetUser.email || `${targetUser.username}@example.com`);
                                    }
                                  } else {
                                    setConfirmModal({
                                      taskId: task.id,
                                      taskType: task.type,
                                      taskData: task.data,
                                      userIdStr: '',
                                      username: 'Unassigned',
                                      userRole: ''
                                    });
                                    setEmailInput('');
                                  }
                                }}
                                className="w-full pl-2.5 pr-6 py-0.5 appearance-none bg-slate-900/40 border border-slate-800 rounded-full text-slate-350 text-[11px] font-semibold focus:outline-none focus:border-cyan-500/50 cursor-pointer transition-all duration-200"
                              >
                                <option value="">Unassigned</option>
                                {allUsers.map((u: any) => (
                                  <option key={u.id} value={u.id}>
                                    @{u.username}
                                  </option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          ) : task.assigned_to ? (
                            <span className="text-slate-250 font-medium whitespace-nowrap">@{task.assigned_to.username}</span>
                          ) : (
                            <span className="text-slate-500 italic whitespace-nowrap">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {task.status !== 'completed' ? (
                            <button
                              onClick={() => handleStartTask(task)}
                              disabled={startingTaskId !== null}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-cyan-400 hover:text-cyan-300 text-xs font-semibold rounded-lg flex items-center gap-1 ml-auto transition-colors whitespace-nowrap"
                            >
                              <Play className="w-3.5 h-3.5" />
                              {startingTaskId === task.id ? 'Loading...' : (task.status === 'in-progress' ? 'Continue' : 'Annotate')}
                            </button>
                          ) : (
                            (() => {
                              const latestAnnotation = task.annotations && task.annotations.length > 0
                                ? task.annotations[task.annotations.length - 1]
                                : null;
                              const qaResult = latestAnnotation?.qa_results && latestAnnotation.qa_results.length > 0
                                ? latestAnnotation.qa_results[latestAnnotation.qa_results.length - 1]
                                : null;

                              if (qaResult?.approved === true) {
                                return <span className="text-emerald-450 font-semibold text-xs flex items-center justify-end gap-1 whitespace-nowrap"><Check className="w-3.5 h-3.5" /> QA Approved</span>;
                              } else if (qaResult?.approved === false) {
                                return <span className="text-rose-400 font-semibold text-xs whitespace-nowrap">QA Rejected</span>;
                              } else {
                                return <span className="text-amber-400 font-semibold text-xs whitespace-nowrap">Awaiting QA</span>;
                              }
                            })()
                          )}
                        </td>
                      </tr>
                    );
                  } else if (item.type === 'batch') {
                    const batchId = item.batchId!;
                    const batchTasks = item.batchTasks || [];
                    const isExpanded = !!expandedBatches[batchId];
                    const toggleExpand = () => {
                      setExpandedBatches(prev => ({
                        ...prev,
                        [batchId]: !prev[batchId]
                      }));
                    };

                    const totalCost = batchTasks.reduce((sum: number, t: any) => sum + t.cost, 0);
                    const completedCount = batchTasks.filter((t: any) => t.status === 'completed').length;
                    const totalCount = batchTasks.length;
                    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                    
                    const allTypes = Array.from(new Set(batchTasks.map((t: any) => t.type)));
                    const commonType = allTypes.length === 1 ? allTypes[0] : 'Mixed';
                    
                    const allPriorities = Array.from(new Set(batchTasks.map((t: any) => t.priority)));
                    const displayPriority = allPriorities.length === 1 ? allPriorities[0] : 'Mixed';

                    const assigneeIds = Array.from(new Set(batchTasks.map((t: any) => t.assigned_to_id)));
                    let assigneeText = '';
                    if (assigneeIds.length === 1) {
                      if (assigneeIds[0] === null) {
                        assigneeText = 'Unassigned';
                      } else {
                        const firstTaskWithAssignee = batchTasks.find((t: any) => t.assigned_to);
                        assigneeText = firstTaskWithAssignee ? `@${firstTaskWithAssignee.assigned_to.username}` : `User ID: ${assigneeIds[0]}`;
                      }
                    } else {
                      assigneeText = 'Distributed';
                    }

                    let displayBatchId = '';
                    if (batchId === 'bulk') {
                      displayBatchId = '#Bulk';
                    } else if (batchId.startsWith('legacy_batch_')) {
                      displayBatchId = `#L-${batchId.replace('legacy_batch_', '')}`;
                    } else {
                      displayBatchId = `#B-${batchId.replace('bulk_batch_', '').slice(-6)}`;
                    }

                    return (
                      <tr 
                        key={item.id} 
                        className="bg-indigo-500/[0.04] dark:bg-indigo-500/[0.02] hover:bg-indigo-500/[0.07] dark:hover:bg-indigo-500/[0.03] transition-all duration-150 border-b border-slate-850/50"
                      >
                        <td className="px-4 py-2.5 transition-all duration-150 border-l-4 border-l-indigo-550">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={toggleExpand}
                              type="button"
                              className="p-1 hover:bg-slate-800/80 rounded transition-colors text-indigo-400 hover:text-indigo-350 shrink-0 cursor-pointer"
                              title={isExpanded ? "Collapse Batch" : "Expand Batch"}
                            >
                              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                            </button>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-indigo-400 dark:text-indigo-300 text-xs">{displayBatchId}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 dark:text-indigo-300 w-max uppercase tracking-wider flex items-center gap-1">
                                <Layers className="w-2.5 h-2.5" />
                                Batch
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5 capitalize text-xs font-medium text-indigo-350">
                            <Layers className="w-3.5 h-3.5 text-indigo-455" />
                            {commonType}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-200 font-semibold">{formatBatchName(batchId)}</span>
                            <span className="px-1.5 py-0.5 bg-slate-950/60 border border-slate-800 text-indigo-400 text-[10px] rounded font-bold shrink-0">
                              {totalCount} task{totalCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            displayPriority === 'high' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                            displayPriority === 'medium' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                            displayPriority === 'low' ? 'bg-slate-500/10 border-slate-500/30 text-slate-400' :
                            'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                          }`}>
                            {displayPriority}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-white font-medium">${totalCost.toFixed(2)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-1 w-24">
                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                              <span>Progress</span>
                              <span>{completedCount}/{totalCount}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-950/80 rounded-full overflow-hidden border border-slate-850">
                              <div 
                                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {user?.role === 'admin' ? (
                            <button
                              type="button"
                              onClick={() => setBatchAssignModal({ batchId, tasks: batchTasks })}
                              className="flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-950/50 hover:bg-slate-950 border border-slate-850 rounded-full text-slate-350 hover:text-white text-[11px] font-semibold transition-all duration-200 cursor-pointer"
                              title="Modify batch assignments"
                            >
                              <Users className="w-3 h-3 text-indigo-400" />
                              <span>{assigneeText}</span>
                            </button>
                          ) : (
                            <span className="text-slate-250 font-medium whitespace-nowrap">{assigneeText}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={toggleExpand}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-350 text-xs font-semibold rounded-lg flex items-center gap-1 ml-auto border border-slate-750 transition-colors cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide' : 'Show'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-250 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </td>
                      </tr>
                    );
                  } else {
                    // batch-child
                    const task = item.task!;
                    return (
                      <tr 
                        key={item.id} 
                        className="bg-slate-900/10 hover:bg-slate-900/20 transition-all duration-150 border-b border-slate-850/30"
                      >
                        <td className="px-4 py-2.5 transition-all duration-150 border-l-4 border-l-transparent pl-8">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-mono select-none font-bold">↳</span>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-slate-300">#00{task.id}</span>
                              <span className="text-[8px] font-bold px-1.5 py-0.2 bg-slate-950/40 border border-slate-850 text-slate-400 rounded w-max uppercase tracking-wider">
                                Task
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5 capitalize text-xs text-slate-400">
                            <Tag className="w-3.5 h-3.5 text-slate-500" />
                            {task.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">
                          <div className="max-w-[360px] truncate flex items-center gap-1.5" title={task.data}>
                            {task.import_source === 'bulk' && (
                              <span className="inline-flex items-center gap-1 shrink-0 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 dark:text-indigo-300 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                                <FileJson className="w-3.5 h-3.5" /> JSON
                              </span>
                            )}
                            <span>{task.data}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            task.priority === 'high' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                            task.priority === 'medium' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                            'bg-slate-500/10 border-slate-500/30 text-slate-400'
                          }`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-white font-medium">${task.cost.toFixed(2)}</td>
                        <td className="px-4 py-2.5">
                          {(() => {
                            const latestAnnotation = task.annotations && task.annotations.length > 0
                              ? task.annotations[task.annotations.length - 1]
                              : null;
                            const qaResult = latestAnnotation?.qa_results && latestAnnotation.qa_results.length > 0
                              ? latestAnnotation.qa_results[latestAnnotation.qa_results.length - 1]
                              : null;

                            if (task.status === 'completed') {
                              if (qaResult?.approved === true) {
                                return <span className="capitalize text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-450 border border-emerald-500/25 whitespace-nowrap">Approved</span>;
                              }
                              return <span className="capitalize text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 whitespace-nowrap">Awaiting QA</span>;
                            }
                            
                            return (
                              <span className={`capitalize text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                task.status === 'in-progress' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                task.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                              }`}>
                                {task.status.replace('-', ' ')}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {user?.role === 'admin' && task.status !== 'completed' ? (
                            <div className="relative inline-block w-32">
                              <select
                                value={task.assigned_to_id || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    const targetUser = allUsers.find(u => u.id === parseInt(val, 10));
                                    if (targetUser) {
                                      setConfirmModal({
                                        taskId: task.id,
                                        taskType: task.type,
                                        taskData: task.data,
                                        userIdStr: val,
                                        username: targetUser.username,
                                        userRole: targetUser.role
                                      });
                                      setEmailInput(targetUser.email || `${targetUser.username}@example.com`);
                                    }
                                  } else {
                                    setConfirmModal({
                                      taskId: task.id,
                                      taskType: task.type,
                                      taskData: task.data,
                                      userIdStr: '',
                                      username: 'Unassigned',
                                      userRole: ''
                                    });
                                    setEmailInput('');
                                  }
                                }}
                                className="w-full pl-2.5 pr-6 py-0.5 appearance-none bg-slate-900/40 border border-slate-800 rounded-full text-slate-350 text-[11px] font-semibold focus:outline-none focus:border-cyan-500/50 cursor-pointer transition-all duration-200"
                              >
                                <option value="">Unassigned</option>
                                {allUsers.map((u: any) => (
                                  <option key={u.id} value={u.id}>
                                    @{u.username}
                                  </option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          ) : task.assigned_to ? (
                            <span className="text-slate-250 font-medium whitespace-nowrap">@{task.assigned_to.username}</span>
                          ) : (
                            <span className="text-slate-500 italic whitespace-nowrap">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {task.status !== 'completed' ? (
                            <button
                              onClick={() => handleStartTask(task)}
                              disabled={startingTaskId !== null}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-cyan-400 hover:text-cyan-300 text-xs font-semibold rounded-lg flex items-center gap-1 ml-auto transition-colors whitespace-nowrap"
                            >
                              <Play className="w-3.5 h-3.5" />
                              {startingTaskId === task.id ? 'Loading...' : (task.status === 'in-progress' ? 'Continue' : 'Annotate')}
                            </button>
                          ) : (
                            (() => {
                              const latestAnnotation = task.annotations && task.annotations.length > 0
                                ? task.annotations[task.annotations.length - 1]
                                : null;
                              const qaResult = latestAnnotation?.qa_results && latestAnnotation.qa_results.length > 0
                                ? latestAnnotation.qa_results[latestAnnotation.qa_results.length - 1]
                                : null;

                              if (qaResult?.approved === true) {
                                return <span className="text-emerald-450 font-semibold text-xs flex items-center justify-end gap-1 whitespace-nowrap"><Check className="w-3.5 h-3.5" /> QA Approved</span>;
                              } else if (qaResult?.approved === false) {
                                return <span className="text-rose-400 font-semibold text-xs whitespace-nowrap">QA Rejected</span>;
                              } else {
                                return <span className="text-amber-400 font-semibold text-xs whitespace-nowrap">Awaiting QA</span>;
                              }
                            })()
                          )}
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-slate-950/20 border-t border-slate-800/60 text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{startIndex + 1}</span> to{' '}
              <span className="font-semibold text-white">{Math.min(endIndex, totalItems)}</span> of{' '}
              <span className="font-semibold text-white">{totalItems}</span> items
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={safePage === 1}
                className="p-2 bg-slate-900/60 border border-slate-800 rounded-xl hover:bg-slate-850 hover:text-white disabled:opacity-40 disabled:hover:bg-slate-900/60 disabled:hover:text-slate-400 disabled:cursor-not-allowed transition-all duration-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                if (
                  totalPages > 7 &&
                  pageNum !== 1 &&
                  pageNum !== totalPages &&
                  Math.abs(pageNum - safePage) > 1
                ) {
                  if (pageNum === 2 && safePage > 3) {
                    return <span key="ellipsis-start" className="px-2 text-slate-650">...</span>;
                  }
                  if (pageNum === totalPages - 1 && safePage < totalPages - 2) {
                    return <span key="ellipsis-end" className="px-2 text-slate-650">...</span>;
                  }
                  return null;
                }

                const isActive = pageNum === safePage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border-cyan-500/40 text-cyan-400 font-bold shadow-lg shadow-cyan-500/5'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={safePage === totalPages}
                className="p-2 bg-slate-900/60 border border-slate-800 rounded-xl hover:bg-slate-850 hover:text-white disabled:opacity-40 disabled:hover:bg-slate-900/60 disabled:hover:text-slate-400 disabled:cursor-not-allowed transition-all duration-200"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          </>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <h3 className="font-display font-bold text-lg text-white mb-4">
              Add New Annotation Task
            </h3>
            
            {/* Toggle */}
            <div className="flex bg-slate-950 p-1 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => { setBulkMode('single'); setFormError(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  bulkMode === 'single' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Single Task
              </button>
              <button
                type="button"
                onClick={() => { setBulkMode('json'); setFormError(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  bulkMode === 'json' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Bulk JSON
              </button>
              <button
                type="button"
                onClick={() => { setBulkMode('csv'); setFormError(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  bulkMode === 'csv' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Bulk CSV / Excel
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-450 text-xs mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              {bulkMode === 'single' ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-semibold block">Task Type</label>
                      <select
                        value={taskType}
                        onChange={(e) => setTaskType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="text">Text Classification</option>
                        <option value="image">Image Labeling</option>
                        <option value="video">Video Labeling</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-semibold block">Priority</label>
                      <select
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-semibold block">Assign To</label>
                      <select
                        value={taskAssignedTo}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTaskAssignedTo(val);
                          if (val) {
                            const targetUser = allUsers.find(u => u.id === parseInt(val, 10));
                            if (targetUser) {
                              setTaskAssigneeEmail(targetUser.email || `${targetUser.username}@example.com`);
                            }
                          } else {
                            setTaskAssigneeEmail('');
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="">Unassigned</option>
                        {allUsers.map((u: any) => (
                          <option key={u.id} value={u.id}>
                            @{u.username}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {taskAssignedTo && (
                    <div className="space-y-1.5 animate-fadeIn">
                      <label className="text-xs text-slate-400 font-semibold block">Assignee Email Address</label>
                      <input
                        type="email"
                        value={taskAssigneeEmail}
                        onChange={(e) => setTaskAssigneeEmail(e.target.value)}
                        required
                        placeholder="e.g. user@company.com"
                        className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-semibold block">Data Payload</label>
                    <textarea
                      rows={4}
                      value={taskData}
                      onChange={(e) => setTaskData(e.target.value)}
                      placeholder={taskType === 'text' ? 'Enter text snippet to annotate' : (taskType === 'video' ? 'Enter video URL (e.g. https://www.w3schools.com/html/mov_bbb.mp4)' : 'Enter image URL (e.g. https://...)')}
                      className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </>
              ) : bulkMode === 'json' ? (
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-semibold block">JSON Data Payload</label>
                  <div className="bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl text-[10px] text-cyan-400 flex items-start gap-2 mb-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Must be a valid JSON array of tasks, e.g. <code>[{"{"}"type": "text", "data": "Sample text", "priority": "high"{"}"}]</code></span>
                  </div>
                  <textarea
                    rows={6}
                    value={bulkJson}
                    onChange={(e) => setBulkJson(e.target.value)}
                    placeholder='[{"type": "text", "data": "Hello world", "priority": "low"}]'
                    className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-semibold block">Upload CSV or Excel Spreadsheet</label>
                    <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl text-[10px] text-cyan-400 flex items-start gap-2 mb-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Supports <code>.csv</code>, <code>.xlsx</code>, and <code>.xls</code> files. Column headers like <code>data</code>, <code>text_passage</code>, or <code>image_url</code> will be mapped to the task data payload. Types (<code>text</code>/<code>image</code>) and priorities will be parsed or auto-detected.
                      </span>
                    </div>

                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-800 border-dashed rounded-2xl cursor-pointer bg-slate-950/30 hover:bg-slate-950/50 hover:border-slate-700 transition-all duration-200">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 text-slate-500 mb-2" />
                          <p className="text-xs text-slate-400 font-medium">
                            {csvFileName ? (
                              <span className="text-cyan-400 font-semibold">{csvFileName}</span>
                            ) : (
                              <span>Click to upload or drag & drop</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1">CSV, XLSX, XLS up to 10MB</p>
                        </div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {csvTasks.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                        <span>Parsed Tasks ({csvTasks.length})</span>
                        <span className="text-emerald-400">Ready to import</span>
                      </div>

                      {/* Preview Table of First 3 Rows */}
                      <div className="bg-slate-950/50 border border-slate-850 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-[11px] text-slate-350">
                          <thead className="bg-slate-950 text-[10px] text-slate-400 border-b border-slate-850">
                            <tr>
                              <th className="px-3 py-1.5 w-16">Type</th>
                              <th className="px-3 py-1.5">Data Payload</th>
                              <th className="px-3 py-1.5 w-16">Priority</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900">
                            {csvTasks.slice(0, 3).map((task, idx) => (
                              <tr key={idx} className="hover:bg-slate-900/10">
                                <td className="px-3 py-1.5 capitalize font-mono text-[10px]">
                                  <span className={`px-1.5 py-0.5 rounded ${
                                    task.type === 'image' 
                                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/25' 
                                      : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25'
                                  }`}>
                                    {task.type}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 truncate max-w-[200px]" title={task.data}>
                                  {task.data}
                                </td>
                                <td className="px-3 py-1.5 capitalize text-[10px]">
                                  <span className={`px-1.5 py-0.5 rounded ${
                                    task.priority === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/25' :
                                    task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25' :
                                    'bg-slate-500/10 text-slate-400 border border-slate-500/25'
                                  }`}>
                                    {task.priority}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {csvTasks.length > 3 && (
                          <div className="bg-slate-950/80 px-3 py-1.5 text-[10px] text-slate-500 border-t border-slate-850 text-center">
                            Showing first 3 rows of {csvTasks.length} total tasks.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {bulkMode !== 'single' && (
                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl space-y-4 animate-fadeIn">
                  <label className="text-xs text-slate-350 font-bold block">Bulk Assignment Options</label>
                  
                  {/* Select Mode */}
                  <div className="flex bg-slate-900/60 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setBulkAssignType('unassigned')}
                      className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                        bulkAssignType === 'unassigned' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Keep Unassigned
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkAssignType('single')}
                      className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                        bulkAssignType === 'single' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Assign to Single Person
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkAssignType('distribute')}
                      className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                        bulkAssignType === 'distribute' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Distribute Tasks
                    </button>
                  </div>

                  {bulkAssignType === 'single' && (
                    <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 font-semibold block">Assign To</label>
                        <select
                          value={bulkSingleAssignee}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBulkSingleAssignee(val);
                            if (val) {
                              const targetUser = allUsers.find(u => u.id === parseInt(val, 10));
                              if (targetUser) {
                                setBulkSingleAssigneeEmail(targetUser.email || `${targetUser.username}@example.com`);
                              }
                            } else {
                              setBulkSingleAssigneeEmail('');
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                        >
                          <option value="">Select User...</option>
                          {allUsers.map((u: any) => (
                            <option key={u.id} value={u.id}>@{u.username}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 font-semibold block">Verify Email</label>
                        <input
                          type="email"
                          value={bulkSingleAssigneeEmail}
                          onChange={(e) => setBulkSingleAssigneeEmail(e.target.value)}
                          placeholder="user@company.com"
                          className="w-full px-3 py-1.5 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                    </div>
                  )}

                  {bulkAssignType === 'distribute' && (
                    <div className="space-y-1.5 animate-fadeIn">
                      <label className="text-[10px] text-slate-455 font-semibold block">Select Users to Distribute Tasks Round-Robin</label>
                      <div className="max-h-28 overflow-y-auto border border-slate-800/80 bg-slate-950/30 p-2 rounded-xl grid grid-cols-2 gap-x-4 gap-y-2">
                        {allUsers.map((u: any) => {
                          const isChecked = bulkSelectedUsers.includes(u.id);
                          return (
                            <label key={u.id} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5 select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setBulkSelectedUsers(prev => prev.filter(id => id !== u.id));
                                  } else {
                                    setBulkSelectedUsers(prev => [...prev, u.id]);
                                  }
                                }}
                                className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500/50 bg-slate-950 cursor-pointer"
                              />
                              <span>@{u.username} ({u.role})</span>
                            </label>
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-relaxed mt-1.5">
                        Uploaded tasks will be evenly distributed round-robin among the {bulkSelectedUsers.length} selected users.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setTaskAssignedTo(''); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTask}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold"
                >
                  {submittingTask ? 'Submitting...' : 'Submit Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Assignment Modal */}
      {batchAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <h3 className="font-display font-bold text-lg text-white mb-2">
              Assign Bulk Batch
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Apply changes to all {batchAssignModal.tasks.length} tasks in <strong>{formatBatchName(batchAssignModal.batchId)}</strong>.
            </p>

            <div className="space-y-4 mb-6">
              {/* Select Assignment Mode */}
              <div className="flex bg-slate-950 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setBatchAssignTypeModal('unassigned')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    batchAssignTypeModal === 'unassigned' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Unassign All
                </button>
                <button
                  type="button"
                  onClick={() => setBatchAssignTypeModal('single')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    batchAssignTypeModal === 'single' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Single User
                </button>
                <button
                  type="button"
                  onClick={() => setBatchAssignTypeModal('distribute')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    batchAssignTypeModal === 'distribute' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Distribute
                </button>
              </div>

              {batchAssignTypeModal === 'single' && (
                <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-455 font-semibold block">Assign To</label>
                    <select
                      value={batchSingleAssigneeModal}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBatchSingleAssigneeModal(val);
                        if (val) {
                          const targetUser = allUsers.find(u => u.id === parseInt(val, 10));
                          if (targetUser) {
                            setBatchSingleAssigneeEmailModal(targetUser.email || `${targetUser.username}@example.com`);
                          }
                        } else {
                          setBatchSingleAssigneeEmailModal('');
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                    >
                      <option value="">Select User...</option>
                      {allUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>@{u.username}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-455 font-semibold block">Verify Email</label>
                    <input
                      type="email"
                      value={batchSingleAssigneeEmailModal}
                      onChange={(e) => setBatchSingleAssigneeEmailModal(e.target.value)}
                      placeholder="user@company.com"
                      className="w-full px-3 py-1.5 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>
              )}

              {batchAssignTypeModal === 'distribute' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="text-[10px] text-slate-455 font-semibold block">Select Users to Distribute Tasks Round-Robin</label>
                  <div className="max-h-28 overflow-y-auto border border-slate-800/80 bg-slate-950/30 p-2 rounded-xl grid grid-cols-2 gap-x-4 gap-y-2">
                    {allUsers.map((u: any) => {
                      const isChecked = batchSelectedUsersModal.includes(u.id);
                      return (
                        <label key={u.id} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5 select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setBatchSelectedUsersModal(prev => prev.filter(id => id !== u.id));
                              } else {
                                setBatchSelectedUsersModal(prev => [...prev, u.id]);
                              }
                            }}
                            className="rounded border-slate-800 text-cyan-500 focus:ring-cyan-500/50 bg-slate-950 cursor-pointer"
                          />
                          <span>@{u.username} ({u.role})</span>
                        </label>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-slate-500 block leading-relaxed mt-1.5">
                    Tasks in this batch will be evenly distributed round-robin among the {batchSelectedUsersModal.length} selected users.
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={isUpdatingBatch}
                onClick={() => {
                  setBatchAssignModal(null);
                  setBatchAssignTypeModal('unassigned');
                  setBatchSingleAssigneeModal('');
                  setBatchSingleAssigneeEmailModal('');
                  setBatchSelectedUsersModal([]);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-semibold transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingBatch}
                onClick={handleApplyBatchAssignment}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all duration-200"
              >
                {isUpdatingBatch ? 'Applying...' : 'Confirm & Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Task Assignment Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <h3 className="font-display font-bold text-lg text-white mb-4">
              Confirm Assignment Change
            </h3>

            <div className="space-y-3 mb-5">
              {/* Task Details Box */}
              <div className="bg-slate-950/50 border border-slate-800 p-3.5 rounded-2xl">
                <label className="text-xs text-slate-400 font-semibold block mb-1">Task Info</label>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-white whitespace-nowrap">Task #00{confirmModal.taskId}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded capitalize font-medium">{confirmModal.taskType}</span>
                </div>
                <p className="text-xs text-slate-400 italic">
                  "{confirmModal.taskData}"
                </p>
              </div>

              {/* Assignee Details Box */}
              <div className="bg-slate-950/50 border border-slate-800 p-3.5 rounded-2xl">
                <label className="text-xs text-slate-400 font-semibold block mb-2">Assigning To</label>
                {confirmModal.userIdStr ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400 text-xs shrink-0">
                      {confirmModal.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white">@{confirmModal.username}</span>
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full capitalize">
                          {confirmModal.userRole}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-rose-450">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-rose-400" />
                    </div>
                    <span className="text-xs font-semibold">Unassigned (Return task to general queue)</span>
                  </div>
                )}
              </div>

              {/* Email Form (Only if assigning) */}
              {confirmModal.userIdStr && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs text-slate-400 font-semibold block">
                    Verify Notification Email
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                    placeholder="e.g. user@company.com"
                    className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500/50"
                  />
                  <span className="text-[10px] text-slate-400 leading-relaxed block mt-1">
                    Assigning this task automatically switches its status to **In Progress** and emails a link to the assignee.
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setConfirmModal(null);
                  setEmailInput('');
                  fetchTasks();
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.userIdStr && !emailInput) {
                    showToast("Please enter a valid email address.", "error");
                    return;
                  }
                  handleAssignTask(confirmModal.taskId, confirmModal.userIdStr, emailInput);
                  setConfirmModal(null);
                  setEmailInput('');
                }}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white rounded-xl text-xs font-bold"
              >
                Confirm & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl animate-slide-in-right ${
          toast.type === 'success' ? 'bg-emerald-950/70 border-emerald-500/30 text-emerald-300' :
          toast.type === 'error' ? 'bg-rose-950/70 border-rose-500/30 text-rose-300' :
          'bg-cyan-950/70 border-cyan-500/30 text-cyan-300'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <Info className="w-4 h-4 text-rose-450" />}
          <span className="text-xs font-semibold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80 cursor-pointer text-slate-400 hover:text-white font-bold">
            &times;
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskManagement;
