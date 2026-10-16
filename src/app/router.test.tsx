import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { routes } from "./router";
import { AuthProvider } from "../features/auth/AuthProvider";
import { setLanguage, tr } from "../i18n/index.js";
let user: any,
  client: QueryClient,
  router: ReturnType<typeof createMemoryRouter>,
  calls: string[];
const admin = {
  id: 8,
  name: "Admin",
  org_id: 1,
  org_name: "Takipsan",
  role: "super_admin",
  used: 0,
  daily_limit: 10,
};
const ticket = {
  id: 4,
  title: "Örnek bilet",
  description: "Müşterinin açıklaması",
  type: "Hata",
  status: "open",
  severity: "s2",
  customer_name: "Yargıcı",
  owner_name: "Verimsoft",
  owner_org_id: 2,
  program: "ushops",
  created_at: "2026-10-07T12:00:00Z",
  updated_at: "2026-10-07T12:00:00Z",
  events: [],
  targets: [],
  orgs: [],
};
beforeEach(() => {
  user = { ...admin };
  calls = [];
  setLanguage("tr");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      const path = String(url);
      calls.push(path);
      let data: any = {},
        status = 200;
      if (path === "/api/login") user = { ...admin };
      else if (path === "/api/logout") user = null;
      else if (path === "/api/me") {
        data = user;
        if (!user) {
          status = 401;
          data = { errorKey: "please_sign_in" };
        }
      } else if (path === "/api/tickets") data = [ticket];
      else if (path === "/api/tickets/4") data = ticket;
      else if (path.startsWith("/api/tickets/")) {
        status = 404;
        data = { errorKey: "ticket_not_found" };
      } else if (path === "/api/admin/organizations")
        data = [
          { id: 1, name: "Takipsan", kind: "contractor", user_count: 1 },
          { id: 2, name: "Verimsoft", kind: "dealer", user_count: 1 },
        ];
      else if (path === "/api/admin/users")
        data = [{ ...admin, system_role: "super_admin", active: true }];
      else if (path === '/api/admin/products') data=[{id:1,name:'ushops',customer_count:1,ticket_count:1},{id:2,name:'ERP',customer_count:0,ticket_count:0}];
      else if (path === '/api/admin/storage') data={provider:'local',account:'',bucket:'',hasCredentials:false,version:0,checked_at:null,usage:[],uptime_seconds:120};
      else if(path==='/api/admin/storage/test') data={ok:true,latency_ms:12,checked_at:'2026-10-08T12:00:00Z'};
      else if (path === "/api/admin/audit") data = [];
      else if (path === "/api/admin/tenants")
        data = [
          {
            id: 1,
            slug: "bekatos",
            name: "Bekatos",
            plan_tier: "enterprise",
            status: "active",
            agent_limit: 500,
            agent_used: 3,
            customer_users_count: 5,
            org_count: 4,
            ticket_count: 10,
            storage_limit_mb: 256000,
            storage_used_bytes: 1048576,
            trial_ends_at: null,
            created_at: "2026-10-07T12:00:00Z",
          },
        ];
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30000 },
      mutations: { retry: false },
    },
  });
});
afterEach(() => {
  cleanup();
  router?.dispose();
  client.clear();
  vi.unstubAllGlobals();
});
function mount(path: string) {
  router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}
describe("Feature routes", () => {
  it('creates products from an admin modal and links to their report', async () => {
    mount('/admin/products');
    await screen.findByRole('heading',{name:tr('products')});
    fireEvent.click(screen.getByRole('button',{name:tr('add_product')}));
    fireEvent.change(screen.getByLabelText(tr('product_name')),{target:{value:'Catalog Product'}});
    fireEvent.click(screen.getByRole('button',{name:tr('save')}));
    await waitFor(()=>{
      const call=vi.mocked(fetch).mock.calls.find(([url,init])=>String(url)==='/api/admin/products' && init?.method==='POST');
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({name:'Catalog Product'});
    });
    expect(screen.getAllByRole('link',{name:tr('product_reports')})[0].getAttribute('href')).toBe('/admin/product-reports?product_id=1');
  });
  it('shows product totals and includes the product filter in report requests', async () => {
    const original=globalThis.fetch;
    vi.stubGlobal('fetch',vi.fn(async(url,init)=>{
      if(String(url).startsWith('/api/admin/reports?')) return new Response(JSON.stringify({total:1,open:1,closed:0,averageResolutionHours:null,byStatus:[],bySeverity:[],byDealer:[],byProduct:[{id:1,name:'ushops',count:1,open:1,closed:0}],rows:[{...ticket,dealer_name:'Verimsoft'}]}),{status:200});
      return original(url,init);
    }));
    mount('/admin/product-reports');
    const filter=await screen.findByLabelText(tr('product'));
    fireEvent.change(filter,{target:{value:'1'}});
    fireEvent.click(screen.getByRole('button',{name:tr('run_report')}));
    await waitFor(()=>expect(router.state.location.search).toContain('product_id=1'));
    await waitFor(()=>expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('/api/admin/reports?product_id=1'))).toBe(true));
    expect(screen.getAllByRole('columnheader',{name:tr('product')})).toHaveLength(2);
  });
  it('lets admins configure and reorder customer-specific support companies', async () => {
    mount('/admin/organizations');
    fireEvent.click(await screen.findByRole('button',{name:tr('add_company')}));
    const first=screen.getByLabelText(tr('support_chain_level',{level:1}));
    expect(first.hasAttribute('required')).toBe(true);
    fireEvent.change(first,{target:{value:'2'}});
    fireEvent.click(screen.getByRole('button',{name:tr('add_support_company')}));
    fireEvent.change(screen.getByLabelText(tr('support_chain_level',{level:2})),{target:{value:'1'}});
    fireEvent.click(screen.getByRole('button',{name:tr('support_chain_move_up',{level:2})}));
    expect((screen.getByLabelText(tr('support_chain_level',{level:1})) as HTMLSelectElement).value).toBe('1');
    expect((screen.getByLabelText(tr('support_chain_level',{level:2})) as HTMLSelectElement).value).toBe('2');
    fireEvent.click(screen.getByRole('button',{name:tr('support_chain_remove',{level:2})}));
    expect(screen.queryByLabelText(tr('support_chain_level',{level:2}))).toBeNull();
    expect(screen.queryByLabelText(tr('responsible_dealer'))).toBeNull();
    fireEvent.change(screen.getByLabelText(tr('company_name')),{target:{value:'Customer X'}});
    fireEvent.change(screen.getByLabelText(tr('application_used')),{target:{value:'2'}});
    fireEvent.click(screen.getByRole('button',{name:tr('save')}));
    await waitFor(() => {
      const saved=vi.mocked(fetch).mock.calls.find(([url, init]) => String(url)==='/api/admin/organizations' && init?.method==='POST');
      expect(saved).toBeTruthy();
      expect(JSON.parse(String(saved![1]!.body)).support_chain).toEqual([1]);
      expect(JSON.parse(String(saved![1]!.body)).product_id).toBe('2');
    });
  });
  it('confirms user deletion, supports cancel, hides own delete action and refreshes the list', async () => {
    const original = globalThis.fetch;
    let deleted = false;
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (String(url) === '/api/admin/users') return new Response(JSON.stringify([
        { ...admin, system_role:'super_admin', active:true },
        ...(!deleted ? [{ id:9, name:'Delete Target', email:'target@example.test', org_name:'Verimsoft', org_kind:'dealer', system_role:'member', active:true }] : [])
      ]), { status:200, headers:{'Content-Type':'application/json'} });
      if (String(url) === '/api/admin/users/9/delete') { deleted = true; return new Response(JSON.stringify({ok:true}), {status:200}); }
      return original(url, init);
    }));
    mount('/admin/users');
    const remove = await screen.findByRole('button', {name:'Delete Target kullanıcısını sil'});
    expect(screen.queryByRole('button', {name:'Admin kullanıcısını sil'})).toBeNull();
    fireEvent.click(remove);
    expect(deleted).toBe(false);
    fireEvent.click(screen.getByRole('button', {name:'Vazgeç'}));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(remove);
    fireEvent.click(screen.getByRole('button', {name:'Kullanıcıyı sil'}));
    await waitFor(() => expect(screen.queryByText('Delete Target')).toBeNull());
    expect(deleted).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Kullanıcı silindi');
  });
  it('opens user creation in a dialog and restores focus when dismissed',async()=>{
    mount('/admin/users');
    await screen.findByRole('button',{name:'Admin düzenle'});
    const trigger=screen.getByRole('button',{name:'Kullanıcı ekle'});trigger.focus();fireEvent.click(trigger);
    const dialog=await screen.findByRole('dialog',{name:'Kullanıcı ekle'});
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText('Ad soyad'));
    fireEvent(dialog,new Event('cancel',{bubbles:false,cancelable:true}));
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
  it('renders cloud settings and tests the connection without losing the draft on language change',async()=>{
    mount('/admin/storage');
    const input=await screen.findByLabelText('Secret Access Key');
    fireEvent.change(input,{target:{value:'draft-secret'}});
    fireEvent.change(screen.getByRole('combobox',{name:'Dil'}),{target:{value:'en'}});
    expect((screen.getByLabelText('Secret Access Key') as HTMLInputElement).value).toBe('draft-secret');
    fireEvent.click(screen.getByRole('button',{name:'Test connection'}));
    await screen.findByText(/Connection test passed/);
    expect(calls).toContain('/api/admin/storage/test');
  });
  it("opens a ticket directly and supports back/forward navigation", async () => {
    mount("/tickets/4");
    await screen.findByRole("heading", { name: "Örnek bilet" });
    await act(() => router.navigate("/tickets?status=open&q=Örnek"));
    await screen.findByRole("link", { name: "Örnek bilet" });
    expect(
      (
        screen.getByPlaceholderText(
          "Destek istemi numarası veya başlık ara…",
        ) as HTMLInputElement
      ).value,
    ).toBe("Örnek");
    await act(() => router.navigate(-1));
    await screen.findByRole("heading", { name: "Örnek bilet" });
    await act(() => router.navigate(1));
    expect(router.state.location.search).toContain("status=open");
  });
  it("returns to the requested ticket after login", async () => {
    user = null;
    mount("/tickets/4");
    await screen.findByRole("heading", { name: "Tekrar hoş geldiniz." });
    fireEvent.change(screen.getByLabelText("E-posta adresi"), {
      target: { value: "admin@test.local" },
    });
    fireEvent.change(screen.getByLabelText("Şifre"), {
      target: { value: "Test1234!" },
    });
    fireEvent.submit(screen.getByLabelText("Şifre").closest("form")!);
    await screen.findByRole("heading", { name: "Örnek bilet" });
    expect(router.state.location.pathname).toBe("/tickets/4");
  });
  it("blocks admin screens for customers without loading admin data", async () => {
    user = { ...admin, role: "customer" };
    mount("/admin/users");
    await screen.findByRole("alert");
    expect(calls.some((c) => c.startsWith("/api/admin/"))).toBe(false);
  });
  it("loads only user and company data on the user screen", async () => {
    mount("/admin/users");
    await screen.findByRole("button", { name: "Admin düzenle" });
    expect(calls).toContain("/api/admin/users");
    expect(calls).toContain("/api/admin/organizations");
    expect(
      calls.some((c) => c.includes("/reports") || c.includes("/audit")),
    ).toBe(false);
  });
  it("keeps unsaved company fields while switching language", async () => {
    mount("/admin/organizations");
    fireEvent.click(await screen.findByRole("button", { name: "Şirket ekle" }));
    fireEvent.change(await screen.findByLabelText("Şirket adı"), {
      target: { value: "Kaydedilmemiş şirket" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Dil" }), {
      target: { value: "en" },
    });
    await screen.findByRole("heading", { name: "Company management" });
    expect(
      (screen.getByLabelText("Company name") as HTMLInputElement).value,
    ).toBe("Kaydedilmemiş şirket");
    expect(calls.filter((c) => c === "/api/admin/organizations")).toHaveLength(
      1,
    );
  });
  it("shows an unavailable ticket without rendering stale ticket data", async () => {
    mount("/tickets/4");
    await screen.findByRole("heading", { name: "Örnek bilet" });
    await act(() => router.navigate("/tickets/999"));
    await screen.findByRole("alert");
    expect(screen.queryByRole("heading", { name: "Örnek bilet" })).toBeNull();
  });
  it("clears private cached data on logout", async () => {
    mount("/tickets/4");
    await screen.findByRole("heading", { name: "Örnek bilet" });
    fireEvent.click(screen.getByTitle("Çıkış yap"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(client.getQueryData(["ticket", "4"])).toBeUndefined();
    expect(router.state.location.state?.from).toBeUndefined();
  });
  it('redirects a member to dashboard when login carries an admin destination', async () => {
    user = null;
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      const response = await original(url, init);
      if (String(url) === '/api/login') user = { ...admin, role: 'dealer' };
      return response;
    }));
    mount('/admin/users');
    await screen.findByLabelText('Şifre');
    fireEvent.change(screen.getByLabelText('E-posta adresi'), {target:{value:'member@test.local'}});
    fireEvent.change(screen.getByLabelText('Şifre'), {target:{value:'Test1234!'}});
    fireEvent.submit(screen.getByLabelText('Şifre').closest('form')!);
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(calls.some(c => c.startsWith('/api/admin/'))).toBe(false);
  });
  it("renders tenant subscriptions and submits new workspace creation", async () => {
    mount("/admin/tenants");
    await screen.findByRole("heading", { name: tr("tenants") });
    fireEvent.click(screen.getByRole("button", { name: tr("add_tenant") }));
    fireEvent.change(screen.getByLabelText(tr("tenant_name")), {
      target: { value: "Verimsoft Bulut" },
    });
    fireEvent.change(screen.getByLabelText(tr("tenant_slug")), {
      target: { value: "verimsoft-bulut" },
    });
    fireEvent.click(screen.getByRole("button", { name: tr("save") }));
    await waitFor(() => {
      const call = vi
        .mocked(fetch)
        .mock.calls.find(
          ([url, init]) =>
            String(url) === "/api/admin/tenants" && init?.method === "POST",
        );
      expect(call).toBeTruthy();
      const body = JSON.parse(String(call?.[1]?.body));
      expect(body.name).toBe("Verimsoft Bulut");
      expect(body.slug).toBe("verimsoft-bulut");
    });
  });
});
