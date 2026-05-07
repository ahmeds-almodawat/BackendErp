import { relations } from "drizzle-orm";
import {
  companies,
  branches,
  stores,
  suppliers,
  items,
  chartAccounts,
  costCenters,
  employees,
  users,
  roles,
  permissions,
  userRoles,
  rolePermissions,
  accessScopes,
} from "./schema";

export const companiesRelations = relations(companies, ({ many }) => ({
  branches: many(branches),
  suppliers: many(suppliers),
  items: many(items),
  chartAccounts: many(chartAccounts),
  costCenters: many(costCenters),
  employees: many(employees),
  users: many(users),
  roles: many(roles),
  permissions: many(permissions),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  company: one(companies, { fields: [branches.companyId], references: [companies.id] }),
  stores: many(stores),
  employees: many(employees),
  costCenters: many(costCenters),
}));

export const storesRelations = relations(stores, ({ one }) => ({
  branch: one(branches, { fields: [stores.branchId], references: [branches.id] }),
}));

export const suppliersRelations = relations(suppliers, ({ one }) => ({
  company: one(companies, { fields: [suppliers.companyId], references: [companies.id] }),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  company: one(companies, { fields: [items.companyId], references: [companies.id] }),
}));

export const chartAccountsRelations = relations(chartAccounts, ({ one }) => ({
  company: one(companies, { fields: [chartAccounts.companyId], references: [companies.id] }),
}));

export const costCentersRelations = relations(costCenters, ({ one }) => ({
  company: one(companies, { fields: [costCenters.companyId], references: [companies.id] }),
  branch: one(branches, { fields: [costCenters.branchId], references: [branches.id] }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  company: one(companies, { fields: [employees.companyId], references: [companies.id] }),
  branch: one(branches, { fields: [employees.branchId], references: [branches.id] }),
  user: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, { fields: [users.companyId], references: [companies.id] }),
  employee: one(employees, { fields: [users.employeeId], references: [employees.id] }),
  roles: many(userRoles),
  accessScopes: many(accessScopes),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  company: one(companies, { fields: [roles.companyId], references: [companies.id] }),
  users: many(userRoles),
  permissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ one, many }) => ({
  company: one(companies, { fields: [permissions.companyId], references: [companies.id] }),
  roles: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));

export const accessScopesRelations = relations(accessScopes, ({ one }) => ({
  user: one(users, { fields: [accessScopes.userId], references: [users.id] }),
}));
