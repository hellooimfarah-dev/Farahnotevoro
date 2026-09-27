"""Focused regression test for Task status extension (5 values).

Tests the extended Task CHECK constraint from 3 to 5 status values:
  - backlog, todo, in_progress, review, done

Test credentials: demo@notevoro.com / Demo1234! (Pro plan)
"""
import requests
import json

# Use external preview URL
BASE_URL = "https://d723ba28-0f44-43ea-8aa3-1bc686245383.preview.emergentagent.com"
API = f"{BASE_URL}/api/v1"

# Test credentials
DEMO_USER = {"email": "demo@notevoro.com", "password": "Demo1234!"}

# All 5 valid statuses
VALID_STATUSES = ["backlog", "todo", "in_progress", "review", "done"]


def _login(email, password):
    """Login and return token."""
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        print(f"❌ Login failed for {email}: {r.status_code} {r.text}")
        return None
    return r.json()["token"]


def _h(token):
    """Return auth headers."""
    return {"Authorization": f"Bearer {token}"}


def _get_spaces(token):
    """Get user's spaces."""
    r = requests.get(f"{API}/spaces", headers=_h(token))
    if r.status_code != 200:
        return []
    return r.json()


def _find_space_by_name(token, name):
    """Find space by name."""
    spaces = _get_spaces(token)
    for s in spaces:
        if s["name"] == name:
            return s
    return None


def test_1_login():
    """Test 1: Login works and returns a token"""
    print("\n=== Test 1: Login ===")
    token = _login(**DEMO_USER)
    if not token:
        print("❌ FAIL: Login failed")
        return False, None
    print(f"✅ PASS: Login successful, token received")
    return True, token


def test_2_get_spaces(token):
    """Test 2: GET /api/v1/spaces returns user's spaces"""
    print("\n=== Test 2: GET /spaces ===")
    r = requests.get(f"{API}/spaces", headers=_h(token))
    if r.status_code != 200:
        print(f"❌ FAIL: GET /spaces returned {r.status_code}")
        print(f"Response: {r.text}")
        return False, None
    
    spaces = r.json()
    print(f"✅ PASS: GET /spaces returned {len(spaces)} space(s)")
    
    # Find "Notevoro Dev" team space
    notevoro_dev = None
    for s in spaces:
        if "notevoro" in s["name"].lower() and "dev" in s["name"].lower():
            notevoro_dev = s
            break
    
    if not notevoro_dev:
        print(f"⚠️  WARNING: 'Notevoro Dev' space not found. Available spaces:")
        for s in spaces:
            print(f"  - {s['name']} (type: {s['type']}, id: {s['id']})")
        # Use first team space as fallback
        for s in spaces:
            if s.get("type") == "team":
                notevoro_dev = s
                print(f"  Using fallback team space: {s['name']}")
                break
    
    if not notevoro_dev:
        print("❌ FAIL: No team space found")
        return False, None
    
    print(f"  Found space: {notevoro_dev['name']} (id: {notevoro_dev['id']})")
    return True, notevoro_dev["id"]


def test_3_create_tasks_with_5_statuses(token, space_id):
    """Test 3: POST task for each of the 5 statuses → expect 201"""
    print("\n=== Test 3: Create tasks with 5 statuses ===")
    
    created_tasks = []
    all_passed = True
    
    for status in VALID_STATUSES:
        r = requests.post(
            f"{API}/spaces/{space_id}/tasks",
            json={
                "title": f"Task {status}",
                "status": status,
                "priority": "medium"
            },
            headers=_h(token)
        )
        
        if r.status_code != 201:
            print(f"❌ FAIL: Create task with status '{status}' returned {r.status_code}")
            print(f"Response: {r.text}")
            all_passed = False
        else:
            task = r.json()
            created_tasks.append(task)
            print(f"✅ PASS: Created task with status '{status}' (id: {task['id']})")
    
    if all_passed:
        print(f"✅ PASS: All 5 tasks created successfully")
    
    return all_passed, created_tasks


def test_4_list_tasks(token, space_id, created_tasks):
    """Test 4: GET /api/v1/spaces/{sid}/tasks → verify all 5 appear with correct status"""
    print("\n=== Test 4: List tasks ===")
    
    r = requests.get(f"{API}/spaces/{space_id}/tasks?limit=200", headers=_h(token))
    
    if r.status_code != 200:
        print(f"❌ FAIL: GET /tasks returned {r.status_code}")
        print(f"Response: {r.text}")
        return False
    
    tasks = r.json()
    print(f"  Retrieved {len(tasks)} task(s)")
    
    # Verify all created tasks appear with correct status
    all_found = True
    for created_task in created_tasks:
        found = False
        for task in tasks:
            if task["id"] == created_task["id"]:
                found = True
                if task["status"] != created_task["status"]:
                    print(f"❌ FAIL: Task {task['id']} has status '{task['status']}', expected '{created_task['status']}'")
                    all_found = False
                else:
                    print(f"✅ Found task '{task['title']}' with status '{task['status']}'")
                break
        
        if not found:
            print(f"❌ FAIL: Task {created_task['id']} not found in list")
            all_found = False
    
    if all_found:
        print(f"✅ PASS: All created tasks found with correct status values")
    
    return all_found


def test_5_update_task_status(token, space_id, created_tasks):
    """Test 5: PATCH task to change status (todo → review → done) → expect 200"""
    print("\n=== Test 5: Update task status ===")
    
    # Find a task with status 'todo'
    todo_task = None
    for task in created_tasks:
        if task["status"] == "todo":
            todo_task = task
            break
    
    if not todo_task:
        print("⚠️  SKIP: No 'todo' task found to update")
        return True
    
    task_id = todo_task["id"]
    
    # Update to 'review'
    r1 = requests.patch(
        f"{API}/spaces/{space_id}/tasks/{task_id}",
        json={"status": "review"},
        headers=_h(token)
    )
    
    if r1.status_code != 200:
        print(f"❌ FAIL: PATCH task to 'review' returned {r1.status_code}")
        print(f"Response: {r1.text}")
        return False
    
    updated_task = r1.json()
    if updated_task["status"] != "review":
        print(f"❌ FAIL: Task status is '{updated_task['status']}', expected 'review'")
        return False
    
    print(f"✅ PASS: Updated task to status 'review'")
    
    # Update to 'done'
    r2 = requests.patch(
        f"{API}/spaces/{space_id}/tasks/{task_id}",
        json={"status": "done"},
        headers=_h(token)
    )
    
    if r2.status_code != 200:
        print(f"❌ FAIL: PATCH task to 'done' returned {r2.status_code}")
        print(f"Response: {r2.text}")
        return False
    
    updated_task2 = r2.json()
    if updated_task2["status"] != "done":
        print(f"❌ FAIL: Task status is '{updated_task2['status']}', expected 'done'")
        return False
    
    print(f"✅ PASS: Updated task to status 'done'")
    print(f"✅ PASS: Status transition todo → review → done works correctly")
    
    return True


def test_6_invalid_status(token, space_id):
    """Test 6: POST task with invalid status 'bogus_status' → should be rejected"""
    print("\n=== Test 6: Invalid status rejection ===")
    
    r = requests.post(
        f"{API}/spaces/{space_id}/tasks",
        json={
            "title": "Task with invalid status",
            "status": "bogus_status",
            "priority": "medium"
        },
        headers=_h(token)
    )
    
    # Should be rejected (4xx or 500)
    if r.status_code in [200, 201]:
        print(f"❌ FAIL: Invalid status was accepted (returned {r.status_code})")
        print(f"Response: {r.text}")
        return False
    
    print(f"✅ PASS: Invalid status 'bogus_status' rejected with {r.status_code}")
    print(f"  Response: {r.text[:200]}")
    
    return True


def test_7_space_home(token, space_id):
    """Test 7: GET /api/v1/spaces/{sid}/home returns 200 with stats"""
    print("\n=== Test 7: GET /spaces/{sid}/home ===")
    
    r = requests.get(f"{API}/spaces/{space_id}/home", headers=_h(token))
    
    if r.status_code != 200:
        print(f"❌ FAIL: GET /home returned {r.status_code}")
        print(f"Response: {r.text}")
        return False
    
    data = r.json()
    
    # Check for stats object
    if "stats" not in data:
        print(f"❌ FAIL: Response missing 'stats' object")
        print(f"Response keys: {list(data.keys())}")
        return False
    
    stats = data["stats"]
    print(f"  Stats: {json.dumps(stats, indent=2)}")
    
    # Check for tasks and activity arrays
    has_tasks = "tasks" in data or "recent_tasks" in data
    has_activity = "activity" in data or "recent_activity" in data
    
    print(f"  Has tasks array: {has_tasks}")
    print(f"  Has activity array: {has_activity}")
    
    print(f"✅ PASS: GET /home returned 200 with stats object")
    
    return True


def test_8_space_projects(token, space_id):
    """Test 8: GET /api/v1/spaces/{sid}/projects returns 200"""
    print("\n=== Test 8: GET /spaces/{sid}/projects ===")
    
    r = requests.get(f"{API}/spaces/{space_id}/projects", headers=_h(token))
    
    if r.status_code != 200:
        print(f"❌ FAIL: GET /projects returned {r.status_code}")
        print(f"Response: {r.text}")
        return False
    
    projects = r.json()
    print(f"  Retrieved {len(projects)} project(s)")
    
    print(f"✅ PASS: GET /projects returned 200")
    
    return True


def main():
    print("=" * 80)
    print("TASK STATUS REGRESSION TEST (5 values: backlog/todo/in_progress/review/done)")
    print("=" * 80)
    
    results = []
    
    # Test 1: Login
    passed, token = test_1_login()
    results.append(("Login", passed))
    if not passed:
        print("\n❌ CRITICAL: Cannot proceed without login")
        return
    
    # Test 2: Get spaces
    passed, space_id = test_2_get_spaces(token)
    results.append(("GET /spaces", passed))
    if not passed:
        print("\n❌ CRITICAL: Cannot proceed without space")
        return
    
    # Test 3: Create tasks with 5 statuses
    passed, created_tasks = test_3_create_tasks_with_5_statuses(token, space_id)
    results.append(("Create tasks (5 statuses)", passed))
    
    # Test 4: List tasks
    if created_tasks:
        passed = test_4_list_tasks(token, space_id, created_tasks)
        results.append(("List tasks", passed))
        
        # Test 5: Update task status
        passed = test_5_update_task_status(token, space_id, created_tasks)
        results.append(("Update task status", passed))
    
    # Test 6: Invalid status
    passed = test_6_invalid_status(token, space_id)
    results.append(("Invalid status rejection", passed))
    
    # Test 7: Space home
    passed = test_7_space_home(token, space_id)
    results.append(("GET /home", passed))
    
    # Test 8: Space projects
    passed = test_8_space_projects(token, space_id)
    results.append(("GET /projects", passed))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    total_passed = sum(1 for _, result in results if result)
    total_tests = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {name}")
    
    print("\n" + "=" * 80)
    print(f"OVERALL: {total_passed}/{total_tests} tests passed")
    print("=" * 80)
    
    if total_passed == total_tests:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️  {total_tests - total_passed} test(s) failed")


if __name__ == "__main__":
    main()
