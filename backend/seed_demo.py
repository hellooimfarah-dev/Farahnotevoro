import requests, datetime as dt, random

BASE = "http://localhost:8001/api/v1"
EMAIL = "demo@notevoro.com"
PW = "Demo1234!"

def login():
    r = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PW})
    if r.status_code != 200:
        r = requests.post(f"{BASE}/auth/signup", json={"name": "Demo User", "email": EMAIL, "password": PW})
    return r.json()["token"]

def main():
    tok = login()
    h = {"Authorization": f"Bearer {tok}"}
    # find or create Notevoro Dev
    spaces = requests.get(f"{BASE}/spaces", headers=h).json()
    dev = next((s for s in spaces if s["name"] == "Notevoro Dev"), None)
    if not dev:
        r = requests.post(f"{BASE}/spaces", headers=h, json={
            "name": "Notevoro Dev", "type": "team", "description": "Development workspace",
            "icon": "code", "accent": "slate"})
        dev = r.json()
        print("created space", r.status_code)
    sid = dev["id"]
    print("space", sid)

    # projects
    proj_names = ["Architecture", "Backend", "Frontend", "AI System", "Testing", "Launch"]
    colors = ["slate", "blue", "green", "violet", "amber", "pink"]
    projects = []
    existing = requests.get(f"{BASE}/spaces/{sid}/projects", headers=h).json()
    if len(existing) < 3:
        base = dt.date.today()
        for i, (n, c) in enumerate(zip(proj_names, colors)):
            due = (base + dt.timedelta(days=10 + i * 6)).isoformat()
            r = requests.post(f"{BASE}/spaces/{sid}/projects", headers=h,
                              json={"name": n, "status": "active", "color": c, "due_at": f"{due}T12:00:00Z"})
            if r.status_code < 300:
                projects.append(r.json())
        print("projects", len(projects))
    else:
        projects = existing

    # tasks with varied statuses/priorities/due dates
    tasks = [
        ("Implement authentication flow", "in_progress", "high", 3),
        ("Build API endpoints", "in_progress", "high", 4),
        ("Design system components", "todo", "medium", 6),
        ("Write unit tests", "todo", "medium", 8),
        ("AI model training pipeline", "review", "high", 10),
        ("Prepare launch documentation", "todo", "low", 13),
        ("Fix mobile responsiveness", "in_progress", "medium", 15),
        ("Security audit", "backlog", "high", 20),
        ("Mobile app prototype", "backlog", "medium", 22),
        ("Database optimization", "backlog", "low", 24),
        ("UI component library", "backlog", "medium", 5),
        ("API documentation", "todo", "medium", 7),
        ("User authentication", "todo", "high", 9),
        ("Performance testing setup", "todo", "low", 11),
        ("Settings page", "in_progress", "medium", 2),
        ("AI model integration", "in_progress", "high", 4),
        ("Payment system", "in_progress", "high", 6),
        ("Landing page design", "review", "medium", 1),
        ("Code review - auth", "review", "low", 3),
        ("Analytics dashboard", "review", "medium", 5),
        ("Project setup", "done", "high", -2),
        ("Database schema", "done", "medium", -3),
        ("Basic UI framework", "done", "low", -5),
    ]
    existing_t = requests.get(f"{BASE}/spaces/{sid}/tasks", headers=h).json()
    if len(existing_t) < 5:
        base = dt.datetime.utcnow()
        for i, (title, status, pri, days) in enumerate(tasks):
            due = (base + dt.timedelta(days=days)).replace(microsecond=0).isoformat() + "Z"
            pid = projects[i % len(projects)]["id"] if projects else None
            body = {"title": title, "status": status, "priority": pri, "due_at": due}
            if pid:
                body["project_id"] = pid
            r = requests.post(f"{BASE}/spaces/{sid}/tasks", headers=h, json=body)
            if r.status_code >= 300:
                print("task err", r.status_code, r.text[:120]); break
        print("tasks seeded")
    else:
        print("tasks exist", len(existing_t))

    # a couple upcoming events
    r = requests.get(f"{BASE}/spaces/{sid}/home", headers=h)
    print("home stats:", r.json().get("stats"))

if __name__ == "__main__":
    main()
