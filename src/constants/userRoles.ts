export const UserRole = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student'
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];
