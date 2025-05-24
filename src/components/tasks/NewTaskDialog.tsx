"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus, Save, X, Trash2, ListChecks, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '../../hooks/use-session'; // Adjust the path as needed
import type { Task, Subtask, TaskStatus } from './TaskItem'; // Assuming TaskItem exports these
import { formatInputDateToISO } from '@/lib/utils'; // Updated import path
import { TagInput, TagData } from './TagInput';
const taskStatuses: TaskStatus[] = ['Backlog', 'In Progress', 'Review', 'Done'];
type TaskPriority = 'low' | 'medium' | 'high';
const priorities: TaskPriority[] = ['low', 'medium', 'high'];


interface NewTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (newTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export function NewTaskDialog({ isOpen, onClose, onAddTask }: NewTaskDialogProps) {
  const { toast } = useToast();
  const { session, isLoading: isSessionLoading } = useSession(); // Get user session with loading state

  const getInitialState = () => ({
    title: '',
    description: '',
    status: 'Backlog' as TaskStatus,
    priority: 'medium' as TaskPriority,
    startDate: '', // Store as yyyy-MM-dd
    dueDate: '',   // Store as yyyy-MM-dd
    tags: [] as TagData[],
    tagsInput: '',
    notes: '',
    currentSubtaskTitle: '',
    subtasks: [] as Omit<Subtask, 'id'>[],
  });

  const [formData, setFormData] = useState(getInitialState());

  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialState()); // Reset form when dialog opens
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: 'status' | 'priority') => (value: string) => {
    setFormData(prev => ({ ...prev, [name]: value as TaskStatus | TaskPriority }));
  };

  
  const handleAddSubtask = () => {
    if (!formData.currentSubtaskTitle.trim()) {
      toast({ title: "Subtask Title Empty", description: "Please enter a title for the subtask.", variant: "destructive" });
      return;
    }
    setFormData(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, { title: prev.currentSubtaskTitle.trim(), completed: false }],
      currentSubtaskTitle: '', // Clear input
    }));
  };

  const handleSubtaskInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSubtask();
    }
  };

  const handleRemoveSubtask = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter((_, index) => index !== indexToRemove),
    }));
  };

  const handleAddTag = (tag: TagData) => {
    if (tag.text && !formData.tags.some(t => t.text === tag.text)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
        tagsInput: '', // Clear input after adding
      }));
    }
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, index) => index !== indexToRemove),
    }));
  };

  const handleUpdateTagColor = (index: number, color: string) => {
    setFormData(prev => {
      const updatedTags = [...prev.tags];
      updatedTags[index] = { ...updatedTags[index], color };
      return { ...prev, tags: updatedTags };
    });
  };

  const handleTagInputChange = (value: string) => {
    setFormData(prev => ({ ...prev, tagsInput: value }));
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({ title: "Task Title Required", description: "Please enter a title for the task.", variant: "destructive" });
      return;
    }

    if (isSessionLoading) {
      toast({ 
        title: "Loading...", 
        description: "Please wait while we verify your session.", 
        variant: "default" 
      });
      return;
    }

    // Get the current user ID from the session
    const currentUserId = session?.id;
    
    if (!currentUserId) {
      toast({ 
        title: "Authentication Error", 
        description: "You must be signed in to create tasks. Please sign in and try again.", 
        variant: "destructive" 
      });
      return;
    }

    // Include any typed but not yet added tag
    let finalTags: TagData[] = [...formData.tags];
    if (formData.tagsInput.trim()) {
      const newTagText = formData.tagsInput.trim();
      if (!finalTags.some(tag => tag.text === newTagText)) {
        finalTags.push({ text: newTagText });
      }
    }

    const newTaskData = {
      userId: currentUserId, // Map session.id to task.userId
      title: formData.title,
      description: formData.description || undefined,
      status: formData.status,
      priority: formData.priority,
      startDate: formatInputDateToISO(formData.startDate) || undefined,
      dueDate: formatInputDateToISO(formData.dueDate) || undefined,
      tags: finalTags, // TagData[] format
      notes: formData.notes || undefined,
      subtasks: formData.subtasks.map((st, index) => ({ ...st, id: `new-st-${index}-${Date.now()}` })),
    };

    onAddTask(newTaskData);
    onClose();
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>Fill in the details below to create a new task.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 overflow-y-auto pr-2 flex-grow">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input id="title" name="title" value={formData.title} onChange={handleChange} placeholder="Task title" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Task description" rows={3}/>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select name="status" value={formData.status} onValueChange={handleSelectChange('status')}>
                <SelectTrigger id="status"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {taskStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" value={formData.priority} onValueChange={handleSelectChange('priority')}>
                <SelectTrigger id="priority"><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>
                  {priorities.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" name="startDate" type="date" value={formData.startDate} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" name="dueDate" type="date" value={formData.dueDate} onChange={handleChange} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tagsInput">Tags</Label>
            <TagInput
              tags={formData.tags}
              inputValue={formData.tagsInput}
              onInputChange={handleTagInputChange}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              onUpdateTagColor={handleUpdateTagColor}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} placeholder="Additional notes for the task" rows={3}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentSubtaskTitle" className="flex items-center"><ListChecks className="mr-1.5 h-4 w-4 text-muted-foreground" /> Subtasks</Label>
            <div className="flex items-center gap-2">
              <Input
                id="currentSubtaskTitle"
                name="currentSubtaskTitle"
                value={formData.currentSubtaskTitle}
                onChange={handleChange}
                onKeyDown={handleSubtaskInputKeyDown}
                placeholder="Enter subtask title"
                className="flex-grow"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddSubtask}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            {formData.subtasks.length > 0 && (
              <div className="mt-2 space-y-2 rounded-md border p-3 bg-muted/30 max-h-40 overflow-y-auto">
                {formData.subtasks.map((subtask, index) => (
                  <div key={index} className="flex items-center justify-between p-1.5 bg-background rounded text-sm">
                    <span>{subtask.title}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemoveSubtask(index)}
                      aria-label="Remove subtask"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
          </DialogClose>
          <Button 
            type="button" 
            onClick={handleSubmit} 
            disabled={isSessionLoading}
          >
            <Save className="mr-2 h-4 w-4" /> 
            {isSessionLoading ? "Loading..." : "Save Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
