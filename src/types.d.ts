declare global {
  namespace Express {
    interface Request {
      user?: IAuthUser;
    }
  }
}

// Import types from constants/userRoles
import type { UserRoleType } from './constants/userRoles.js';
export type { UserRoleType };

export interface IAuthUser {
  id: string;
  email: string;
  role: UserRoleType;
  sessionVersion?: string;
  iat?: number;
  exp?: number;
}

export interface IUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRoleType;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeacher extends IUser {
  subjects: string[];
  classes: string[];
}

export interface IStudent extends IUser {
  classId: string;
  sectionId: string;
  rollNumber: number;
}

export interface IClass {
  id: string;
  name: string;
  description?: string;
  sections: ISection[];
  createdAt: Date;
}

export interface ISection {
  id: string;
  name: string;
  classId: string;
}

export interface ISubject {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
}

export interface ITeacherAssignment {
  id: string;
  teacherId: string;
  subjectId: string;
  classId: string;
  sectionId: string;
  assignedAt: Date;
}
