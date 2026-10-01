import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_ONLY_PATH_PREFIXES, isAdminOnlyPath, isAdminRole, PERMISSIONS } from "../lib/rbac.ts";

describe("isAdminRole", () => {
  it("solo admin es admin", () => {
    assert.equal(isAdminRole("admin"), true);
    assert.equal(isAdminRole("agente"), false);
    assert.equal(isAdminRole(""), false);
    assert.equal(isAdminRole("Admin"), false);
  });
});

describe("isAdminOnlyPath", () => {
  it("bloquea equipo/categorias/configuracion y crm/configuracion", () => {
    assert.equal(isAdminOnlyPath("/admin/equipo"), true);
    assert.equal(isAdminOnlyPath("/admin/equipo/123"), true);
    assert.equal(isAdminOnlyPath("/admin/categorias"), true);
    assert.equal(isAdminOnlyPath("/admin/configuracion"), true);
    assert.equal(isAdminOnlyPath("/admin/crm/configuracion"), true);
  });
  it("permite resto del panel", () => {
    assert.equal(isAdminOnlyPath("/admin"), false);
    assert.equal(isAdminOnlyPath("/admin/propiedades"), false);
    assert.equal(isAdminOnlyPath("/admin/crm/inbox"), false);
    assert.equal(isAdminOnlyPath("/admin/crm/pipeline"), false);
    assert.equal(isAdminOnlyPath("/admin/solicitudes"), false);
  });
});

describe("ADMIN_ONLY_PATH_PREFIXES", () => {
  it("incluye crm/configuracion", () => {
    assert.ok((ADMIN_ONLY_PATH_PREFIXES as readonly string[]).includes("/admin/crm/configuracion"));
  });
});

describe("PERMISSIONS", () => {
  it("empleado no puede gestionar equipo/categorias/config", () => {
    assert.deepEqual(PERMISSIONS["team:manage"], ["admin"]);
    assert.deepEqual(PERMISSIONS["categories:manage"], ["admin"]);
    assert.deepEqual(PERMISSIONS["site-settings:manage"], ["admin"]);
    assert.equal((PERMISSIONS["team:manage"] as readonly string[]).includes("agente"), false);
  });
  it("empleado sí puede propiedades y crm lectura/escritura básica", () => {
    assert.ok((PERMISSIONS["properties:write"] as readonly string[]).includes("agente"));
    assert.ok((PERMISSIONS["crm:read"] as readonly string[]).includes("agente"));
    assert.ok((PERMISSIONS["crm:write"] as readonly string[]).includes("agente"));
  });
  it("solo admin puede reasignar, pipeline y outbox", () => {
    assert.deepEqual(PERMISSIONS["crm:assign_any"], ["admin"]);
    assert.deepEqual(PERMISSIONS["crm:manage_pipeline"], ["admin"]);
    assert.deepEqual(PERMISSIONS["crm:manage_outbox"], ["admin"]);
  });
});
