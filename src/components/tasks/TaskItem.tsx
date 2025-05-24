"use client";

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { ChevronDown, ChevronRight, Plus, Trash2, Tag, CalendarDays, AlertTriangle, FileText, Clock as ClockIcon, Play, Square, PauseIcon, Edit2, Activity, ChevronLeft } from 'lucide-react';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn, formatDuration, calculateDurationInSeconds } from '@/lib/utils';
import { TimeLogDialog } from './TimeLogDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TimeLog {
  id:string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  notes?: string;
}

export type TaskStatus = 'Backlog' | 'In Progress' | 'Review' | 'Done';

export interface TagData {
  text: string;
  color?: string;
}

export interface Task {
  id: string;
  userId: string; // Added userId
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string; // ISO string for date
  startDate?: string; // ISO string for date
  tags?: TagData[]; // Store all tags in TagData format
  subtasks?: Subtask[];
  timeLogs?: TimeLog[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskItemProps {
  task: Task;
  onToggleSubtaskCompletion: (taskId: string, subtaskId: string) => void;
  onLogTime: (taskId: string, timeLog: TimeLog) => void;
  onDeleteTask: (taskId: string) => void;
}

export function TaskItem({ task, onToggleSubtaskCompletion, onLogTime, onDeleteTask }: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const [timerSessionState, setTimerSessionState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [sessionInitialStartTime, setSessionInitialStartTime] = useState<number | null>(null);
  const [accumulatedDurationSeconds, setAccumulatedDurationSeconds] = useState<number>(0);
  const [currentSegmentStartTime, setCurrentSegmentStartTime] = useState<number | null>(null);
  const [displayRunTime, setDisplayRunTime] = useState<string>("00:00:00");
  const [isTimeLogDialogOpenForItem, setIsTimeLogDialogOpenForItem] = useState<boolean>(false);
  const [timeLogNotesForItem, setTimeLogNotesForItem] = useState<string>('');
  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const [itemTimeLogCurrentPage, setItemTimeLogCurrentPage] = useState(1);
  const [itemTimeLogItemsPerPage, setItemTimeLogItemsPerPage] = useState(10);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);


  const updateDisplayTime = useCallback(() => {
    if (timerSessionState === 'running' && currentSegmentStartTime) {
      const elapsedInCurrentSegment = (Date.now() - currentSegmentStartTime) / 1000;
      const totalElapsedThisSession = accumulatedDurationSeconds + elapsedInCurrentSegment;
      setDisplayRunTime(formatDuration(totalElapsedThisSession));
    } else if (timerSessionState === 'paused') {
      setDisplayRunTime(formatDuration(accumulatedDurationSeconds));
    } else {
      setDisplayRunTime("00:00:00");
    }
  }, [timerSessionState, currentSegmentStartTime, accumulatedDurationSeconds]);

  useEffect(() => {
    if (timerSessionState === 'running') {
      updateDisplayTime();
      timerIntervalRef.current = setInterval(updateDisplayTime, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      updateDisplayTime();
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerSessionState, updateDisplayTime]);


  const handleStartTimer = () => {
    setTimerSessionState('running');
    const now = Date.now();
    if (!sessionInitialStartTime) {
      setSessionInitialStartTime(now);
      setAccumulatedDurationSeconds(0);
    }
    setCurrentSegmentStartTime(now);
  };

  const handlePauseTimer = () => {
    if (timerSessionState === 'running' && currentSegmentStartTime) {
      const segmentDuration = (Date.now() - currentSegmentStartTime) / 1000;
      setAccumulatedDurationSeconds(prev => prev + segmentDuration);
    }
    setTimerSessionState('paused');
    setCurrentSegmentStartTime(null);
  };

  const handleResumeTimer = () => {
    setTimerSessionState('running');
    setCurrentSegmentStartTime(Date.now());
  };

  const handleStopTimer = () => {
    let finalAccumulated = accumulatedDurationSeconds;
    if (timerSessionState === 'running' && currentSegmentStartTime) {
      finalAccumulated += (Date.now() - currentSegmentStartTime) / 1000;
    }
    setAccumulatedDurationSeconds(finalAccumulated);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (sessionInitialStartTime && finalAccumulated > 1) {
        setTimeLogNotesForItem('');
        setIsTimeLogDialogOpenForItem(true);
    } else {
        setTimerSessionState('idle');
        setSessionInitialStartTime(null);
        setAccumulatedDurationSeconds(0);
        setCurrentSegmentStartTime(null);
        setDisplayRunTime("00:00:00");
        setTimeLogNotesForItem('');
        toast({
            title: "Timer Stopped",
            description: "No significant time was recorded.",
            variant: "default"
        });
    }
  };

  const handleSaveTimeLog = (notes: string) => {
    if (!sessionInitialStartTime || accumulatedDurationSeconds <= 0) {
       setIsTimeLogDialogOpenForItem(false);
        setTimerSessionState('idle');
        setSessionInitialStartTime(null);
        setAccumulatedDurationSeconds(0);
        setCurrentSegmentStartTime(null);
        setDisplayRunTime("00:00:00");
        setTimeLogNotesForItem('');
      toast({
        title: "Timer Stopped",
        description: "No significant time was recorded to log.",
        variant: "default"
      });
      return;
    }

    const newTimeLog: TimeLog = {
      id: `tl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      startTime: new Date(sessionInitialStartTime).toISOString(),
      endTime: new Date(sessionInitialStartTime + accumulatedDurationSeconds * 1000).toISOString(),
      notes: notes,
    };
    onLogTime(task.id, newTimeLog); // This will call the parent's update logic

    setTimerSessionState('idle');
    setSessionInitialStartTime(null);
    setAccumulatedDurationSeconds(0);
    setCurrentSegmentStartTime(null);
    setDisplayRunTime("00:00:00");
    setTimeLogNotesForItem('');
    setIsTimeLogDialogOpenForItem(false);

    toast({
      title: "Time Logged",
      description: `Time for "${task.title}" has been logged.`,
    });
  };

  const handleCloseTimeLogDialog = () => {
    setTimerSessionState('idle');
    setSessionInitialStartTime(null);
    setAccumulatedDurationSeconds(0);
    setCurrentSegmentStartTime(null);
    setDisplayRunTime("00:00:00");
    setTimeLogNotesForItem('');
    setIsTimeLogDialogOpenForItem(false);
  };

  const getPriorityClass = (priority?: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'text-red-600 dark:text-red-500';
      case 'medium': return 'text-yellow-600 dark:text-yellow-500';
      case 'low': return 'text-green-600 dark:text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  const formatDateSafe = (dateString?: string) => {
    if (!dateString) return '';
    if (!isClient) return '...';
    try {
      const date = parseISO(dateString);
      if (isValid(date)) {
        if (dateString.includes('T')) return format(date, 'MMM d, yyyy HH:mm');
        return format(date, 'MMM d, yyyy');
      }
    } catch (e) { /* fall through */ }
    return dateString;
  }

  const getStatusBadgeVariant = (status?: TaskStatus): React.ComponentProps<typeof Badge>['variant'] => {
    switch (status) {
      case 'Done': return 'default';
      case 'In Progress': return 'secondary';
      case 'Review': return 'outline';
      case 'Backlog': return 'destructive';
      default: return 'secondary';
    }
  };

  const totalLoggedTimeSeconds = task.timeLogs?.reduce((total, log) => total + calculateDurationInSeconds(log.startTime, log.endTime), 0) || 0;

  const itemSortedTimeLogs = task.timeLogs?.slice().sort((a, b) => parseISO(b.startTime).getTime() - parseISO(a.startTime).getTime()) || [];
  const itemTotalTimeLogPages = Math.ceil(itemSortedTimeLogs.length / itemTimeLogItemsPerPage);
  const itemPaginatedTimeLogs = itemSortedTimeLogs.slice(
    (itemTimeLogCurrentPage - 1) * itemTimeLogItemsPerPage,
    itemTimeLogCurrentPage * itemTimeLogItemsPerPage
  );

  const handleItemTimeLogItemsPerPageChange = (value: string) => {
    setItemTimeLogItemsPerPage(parseInt(value, 10));
    setItemTimeLogCurrentPage(1);
  };

  return (
    <>
      <TimeLogDialog
        isOpen={isTimeLogDialogOpenForItem}
        onClose={handleCloseTimeLogDialog}
        onSave={handleSaveTimeLog}
        initialNotes={timeLogNotesForItem}
        setInitialNotes={setTimeLogNotesForItem}
      />
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 w-full">
        <CardHeader className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex-1 min-w-0 w-full">
              <Link href={`/tasks/view/${task.id}`} className="text-lg font-medium hover:underline cursor-pointer break-words">
                  {task.title}
              </Link>
              <Badge variant={getStatusBadgeVariant(task.status)} className="ml-2 align-middle text-xs">
                <Activity className="mr-1 h-3 w-3" />{task.status}
              </Badge>
              {task.description && !isExpanded && (
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  {task.description}
                </p>
              )}
            </div>
            <div className="flex items-center flex-wrap justify-start sm:justify-end gap-1 flex-shrink-0 mt-2 sm:mt-0">
              {timerSessionState === 'idle' && (
                <Button size="icon" onClick={handleStartTimer} aria-label="Start timer" className="bg-accent hover:bg-accent/90 text-accent-foreground h-8 w-8">
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {timerSessionState === 'running' && (
                <Button size="icon" onClick={handlePauseTimer} aria-label="Pause timer" className="bg-yellow-500 hover:bg-yellow-600 text-white h-8 w-8">
                  <PauseIcon className="h-4 w-4" />
                </Button>
              )}
              {timerSessionState === 'paused' && (
                <Button size="icon" onClick={handleResumeTimer} aria-label="Resume timer" className="bg-accent hover:bg-accent/90 text-accent-foreground h-8 w-8">
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {(timerSessionState === 'running' || timerSessionState === 'paused') && (
                <Button variant="destructive" size="icon" onClick={handleStopTimer} aria-label="Stop timer" className="h-8 w-8">
                  <Square className="h-4 w-4" />
                </Button>
              )}
              <Link href={`/tasks/${task.id}`}>
                <Button variant="ghost" size="icon" aria-label="Edit task" className="h-8 w-8">
                  <Edit2 className="h-4 w-4 text-blue-500" />
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Delete task" className="h-8 w-8">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the task titled "{task.title}".
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDeleteTask(task.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                      Delete Task
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {(task.subtasks && task.subtasks.length > 0 || task.notes || task.timeLogs && task.timeLogs.length > 0 || task.description) && (
                <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} aria-label={isExpanded ? "Collapse details" : "Expand details"} className="h-8 w-8">
                  {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-2 pt-0 space-y-3">
          {(task.priority || task.dueDate || task.startDate || (task.tags && task.tags.length > 0)) && (
            <div className="space-y-2">
              {task.priority && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className={cn("h-4 w-4", getPriorityClass(task.priority))} />
                  <span className={cn("font-medium", getPriorityClass(task.priority))}>
                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                  </span>
                </div>
              )}
              {isClient && task.startDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>Start: {formatDateSafe(task.startDate)}</span>
                </div>
              )}
              {isClient && task.dueDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>Due: {formatDateSafe(task.dueDate)}</span>
                </div>
              )}
              {task.tags && task.tags.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map((tag, index) => {
                      // Handle both string tags and TagData objects
                      const tagText = typeof tag === 'string' ? tag : tag.text;
                      const tagColor = typeof tag === 'string' ? undefined : tag.color;
                      
                      return (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="text-xs capitalize"
                          style={tagColor ? { backgroundColor: tagColor, color: 'white' } : undefined}
                        >
                          {tagText}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}


          {isExpanded && (
            <div className="pt-2 space-y-3">
              {task.description && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1.5">
                    <FileText className="h-3 w-3"/> Description
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                    {task.description}
                  </p>
                </div>
              )}
              {task.subtasks && task.subtasks.length > 0 && (
                <div className="pl-8 space-y-2 border-l-2 border-muted ml-2 py-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground -ml-8 pl-2 mb-1">Subtasks</h4>
                  {task.subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`subtask-${task.id}-${subtask.id}`}
                        checked={subtask.completed}
                        onCheckedChange={() => onToggleSubtaskCompletion(task.id, subtask.id)}
                        aria-label={`Mark subtask ${subtask.title} as ${subtask.completed ? 'incomplete' : 'complete'}`}
                      />
                      <label
                        htmlFor={`subtask-${task.id}-${subtask.id}`}
                        className={`text-sm cursor-pointer ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}
                      >
                        {subtask.title}
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {task.notes && (
                <div className="pt-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1.5">
                    <FileText className="h-3 w-3"/> Notes
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                    {task.notes}
                  </p>
                </div>
              )}
              {itemSortedTimeLogs.length > 0 && (
                  <div className="pt-2">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1.5">
                          <ClockIcon className="h-3 w-3"/> Recorded Time Logs
                      </h4>
                      <div className="space-y-2 border-t pt-2 mt-1">
                        {itemPaginatedTimeLogs.map(log => (
                            <div key={log.id} className="text-xs text-muted-foreground p-1.5 border rounded-sm bg-muted/20">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">
                                    {formatDateSafe(log.startTime)} - {formatDateSafe(log.endTime)}
                                  </span>
                                  <Badge variant="outline" className="font-mono text-xs py-0.5 px-1.5">
                                    {formatDuration(calculateDurationInSeconds(log.startTime, log.endTime))}
                                  </Badge>
                                </div>
                                {log.notes && <p className="italic mt-0.5 text-xs"> Notes: {log.notes}</p>}
                            </div>
                        ))}
                      </div>
                      {itemTotalTimeLogPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 text-xs">
                            <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Rows:</span>
                                <Select value={String(itemTimeLogItemsPerPage)} onValueChange={handleItemTimeLogItemsPerPageChange}>
                                    <SelectTrigger className="w-[60px] h-7 text-xs">
                                        <SelectValue placeholder={String(itemTimeLogItemsPerPage)} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="text-muted-foreground">
                                Page {itemTimeLogCurrentPage} of {itemTotalTimeLogPages}
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setItemTimeLogCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={itemTimeLogCurrentPage === 1}
                                    className="h-7 w-7"
                                    type="button"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                    <span className="sr-only">Previous Page</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setItemTimeLogCurrentPage(prev => Math.min(itemTotalTimeLogPages, prev + 1))}
                                    disabled={itemTimeLogCurrentPage === itemTotalTimeLogPages}
                                    className="h-7 w-7"
                                    type="button"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                    <span className="sr-only">Next Page</span>
                                </Button>
                            </div>
                        </div>
                      )}
                  </div>
              )}
              {itemSortedTimeLogs.length === 0 && isExpanded && task.timeLogs && (
                 <div className="pt-2">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1.5">
                          <ClockIcon className="h-3 w-3"/> Recorded Time Logs
                      </h4>
                       <p className="text-sm text-muted-foreground">No time logs recorded yet.</p>
                  </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="p-4 pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
           <div> {/* Placeholder for alignment if needed */} </div>
          <div className="flex items-center gap-2">
            {(timerSessionState === 'running' || timerSessionState === 'paused') && (
              <div className="text-xs text-muted-foreground font-mono">
                Session: <span className="font-semibold tabular-nums">{displayRunTime}</span>
              </div>
            )}
            {totalLoggedTimeSeconds > 0 && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ClockIcon className="h-3 w-3" />
                Total Logged: {formatDuration(totalLoggedTimeSeconds)}
              </div>
            )}
          </div>
        </CardFooter>
      </Card>
    </>
  );
}
