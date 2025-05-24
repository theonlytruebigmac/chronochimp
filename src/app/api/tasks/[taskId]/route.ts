import { NextResponse, type NextRequest } from 'next/server';
import { db, safeJSONParse } from '@/lib/db';
import type { Task, Subtask, TimeLog, TagData } from '@/components/tasks/TaskItem';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/auth';

const JWT_SECRET_STRING = process.env.JWT_SECRET;

const SubtaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, { message: "Subtask title cannot be empty." }),
  completed: z.boolean(),
});

const TimeLogSchema = z.object({
  id: z.string(),
  startTime: z.string().datetime({ message: "Invalid start time format." }),
  endTime: z.string().datetime({ message: "Invalid end time format." }),
  notes: z.string().optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1, { message: "Title cannot be empty." }).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['Backlog', 'In Progress', 'Review', 'Done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().datetime({ message: "Invalid due date format." }).optional().nullable(),
  startDate: z.string().datetime({ message: "Invalid start date format." }).optional().nullable(),
  tags: z.array(z.object({
    text: z.string(),
    color: z.string().optional()
  })).optional(),
  subtasks: z.array(SubtaskSchema).optional(),
  timeLogs: z.array(TimeLogSchema).optional(),
  notes: z.string().optional().nullable(),
  // userId is not updatable by client directly
}).partial();

// Update Params type to reflect the new format for Next.js 15.3.2
type RouteParams = {
  taskId: string;
};

export async function GET(request: NextRequest, { params }: { params: RouteParams }) {
  const userId = await getAuthUserId(request);
  
  if (!JWT_SECRET_STRING) {
    return NextResponse.json(
      { error: 'Server configuration error.' },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const taskId = params.taskId;
    const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const dbTask = stmt.get(taskId) as any;

    if (!dbTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (dbTask.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this task' },
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    try {
      const tags = safeJSONParse<TagData[] | string[]>(dbTask.tags, []);
      const subtasks = safeJSONParse<Subtask[]>(dbTask.subtasks, []);
      const timeLogs = safeJSONParse<TimeLog[]>(dbTask.timeLogs, []);

      // Validate the parsed data has the expected structure
      if (!Array.isArray(tags) || !Array.isArray(subtasks) || !Array.isArray(timeLogs)) {
        console.error(`Invalid data structure for task ${taskId}`);
        return NextResponse.json(
          {
            ...dbTask,
            tags: [],
            subtasks: [],
            timeLogs: [],
            dueDate: dbTask.dueDate || undefined,
            startDate: dbTask.startDate || undefined,
            _dataError: 'Some task data could not be parsed correctly'
          },
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      const task: Task = {
        ...dbTask,
        tags,
        subtasks,
        timeLogs,
        dueDate: dbTask.dueDate || undefined,
        startDate: dbTask.startDate || undefined
      };
      
      return NextResponse.json(task, { headers: { 'Content-Type': 'application/json' } });
    } catch (parseError) {
      console.error(`Error parsing task data:`, parseError);
      return NextResponse.json(
        {
          ...dbTask,
          tags: [],
          subtasks: [],
          timeLogs: [],
          dueDate: dbTask.dueDate || undefined,
          startDate: dbTask.startDate || undefined,
          _dataError: 'Task data could not be parsed'
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error(`Failed to fetch task:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: RouteParams }) {
  const authUserId = await getAuthUserId(request);
  if (!JWT_SECRET_STRING) {
    return NextResponse.json(
      { error: 'Server configuration error.' },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  if (!authUserId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  try {
    const taskId = params.taskId;
    
    const body = await request.json();
    const validationResult = UpdateTaskSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input.', details: validationResult.error.flatten().fieldErrors },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const validatedData = validationResult.data;
    const selectStmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const existingDbTask = selectStmt.get(taskId) as Task | undefined;

    if (!existingDbTask) {
      return NextResponse.json(
        { error: 'Task not found for update' },
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (existingDbTask.userId !== authUserId) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this task to update it' },
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const updateFields: { [key: string]: any } = {};
    if (validatedData.title !== undefined) updateFields.title = validatedData.title;
    if (validatedData.description !== undefined) updateFields.description = validatedData.description;
    if (validatedData.status !== undefined) updateFields.status = validatedData.status;
    if (validatedData.priority !== undefined) updateFields.priority = validatedData.priority;
    if (validatedData.dueDate !== undefined) updateFields.dueDate = validatedData.dueDate;
    if (validatedData.startDate !== undefined) updateFields.startDate = validatedData.startDate;
    if (validatedData.tags !== undefined) updateFields.tags = JSON.stringify(validatedData.tags);
    if (validatedData.subtasks !== undefined) updateFields.subtasks = JSON.stringify(validatedData.subtasks);
    if (validatedData.timeLogs !== undefined) updateFields.timeLogs = JSON.stringify(validatedData.timeLogs);
    if (validatedData.notes !== undefined) updateFields.notes = validatedData.notes;
    
    if (Object.keys(updateFields).length === 0) {
      try {
        const currentTask: Task = {
          ...existingDbTask,
          tags: safeJSONParse<TagData[] | string[]>(existingDbTask.tags as unknown as string, []).map(tag => 
            typeof tag === 'string' ? { text: tag } : tag
          ),
          subtasks: safeJSONParse<Subtask[]>(existingDbTask.subtasks as unknown as string, []),
          timeLogs: safeJSONParse<TimeLog[]>(existingDbTask.timeLogs as unknown as string, []),
        };
        return NextResponse.json(
          currentTask,
          { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } catch (parseError) {
        console.error(`Error parsing existing task data:`, parseError);
        return NextResponse.json(
          {
            ...existingDbTask,
            tags: [],
            subtasks: [],
            timeLogs: [],
            _dataError: 'Some task data could not be parsed correctly'
          },
          { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }
    
    updateFields.updatedAt = new Date().toISOString(); 

    const setClauses = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateFields);
    values.push(taskId); 

    const stmt = db.prepare(`UPDATE tasks SET ${setClauses} WHERE id = ?`);
    stmt.run(...values);
    
    const updatedStmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const updatedDbTask = updatedStmt.get(taskId) as any;
    
    try {
      const updatedTask: Task = {
        ...updatedDbTask,
        tags: safeJSONParse<TagData[] | string[]>(updatedDbTask.tags, []),
        subtasks: safeJSONParse<Subtask[]>(updatedDbTask.subtasks, []),
        timeLogs: safeJSONParse<TimeLog[]>(updatedDbTask.timeLogs, []),
      };

      return NextResponse.json(
        updatedTask,
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error(`Error parsing updated task data:`, parseError);
      return NextResponse.json(
        {
          ...updatedDbTask,
          tags: [],
          subtasks: [],
          timeLogs: [],
          _dataError: 'Some task data could not be parsed correctly'
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error(`Failed to update task for user ${authUserId}:`, error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: RouteParams }) {
  const authUserId = await getAuthUserId(request);
  if (!JWT_SECRET_STRING) {
    return NextResponse.json(
      { error: 'Server configuration error.' },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  if (!authUserId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const taskId = params.taskId;
    
    const selectStmt = db.prepare('SELECT userId FROM tasks WHERE id = ?');
    const taskToDelete = selectStmt.get(taskId) as { userId: string } | undefined;

    if (!taskToDelete) {
      return NextResponse.json(
        { error: 'Task not found or already deleted' },
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (taskToDelete.userId !== authUserId) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this task to delete it' },
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const deleteStmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    deleteStmt.run(taskId);
    
    return NextResponse.json(
      { message: 'Task deleted successfully' },
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error(`Failed to delete task:`, error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
