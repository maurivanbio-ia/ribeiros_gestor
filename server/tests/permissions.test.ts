import test from "node:test";
import assert from "node:assert";
import { hasAccess, canAccessModule, UserRole, ModuleName } from "../../client/src/lib/permissions";

test("RBAC - Admin role has full access to all modules", () => {
  const roles: UserRole[] = ["admin"];
  const modules: ModuleName[] = ["dashboard", "financeiro", "rh", "cronograma", "configuracoes"];

  for (const role of roles) {
    for (const module of modules) {
      assert.strictEqual(hasAccess(role, module, "view"), true, `Admin should view ${module}`);
      assert.strictEqual(hasAccess(role, module, "create"), true, `Admin should create ${module}`);
      assert.strictEqual(hasAccess(role, module, "delete"), true, `Admin should delete ${module}`);
    }
  }
});

test("RBAC - Colaborador role has restricted access", () => {
  const role: UserRole = "colaborador";
  
  // Colaborador should view dashboard but not modify/delete
  assert.strictEqual(canAccessModule(role, "dashboard"), true, "Colaborador should view dashboard");
  assert.strictEqual(hasAccess(role, "dashboard", "create"), false, "Colaborador should not create dashboard");
  
  // Colaborador should view/create/edit tasks (portal_colaborador / tarefas)
  assert.strictEqual(hasAccess(role, "portal_colaborador", "view"), true, "Colaborador should view portal_colaborador");
  assert.strictEqual(hasAccess(role, "portal_colaborador", "create"), true, "Colaborador should create in portal_colaborador");
  
  // Colaborador should not access sensitive modules like financial or team settings
  assert.strictEqual(canAccessModule(role, "financeiro"), false, "Colaborador should not access financeiro");
  assert.strictEqual(canAccessModule(role, "gestao_equipe"), false, "Colaborador should not access gestao_equipe");
});

test("RBAC - Coordenador role permissions", () => {
  const role: UserRole = "coordenador";
  
  // Coordenador can view and edit project info, but not delete
  assert.strictEqual(hasAccess(role, "empreendimentos", "view"), true, "Coordenador should view projects");
  assert.strictEqual(hasAccess(role, "empreendimentos", "edit"), true, "Coordenador should edit projects");
  assert.strictEqual(hasAccess(role, "empreendimentos", "delete"), false, "Coordenador should not delete projects");
});
