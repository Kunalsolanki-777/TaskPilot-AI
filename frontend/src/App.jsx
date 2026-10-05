
import { useEffect, useState } from "react";
import "./index.css";

const API = "http://127.0.0.1:8000";

function App() {
  const [request, setRequest] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingTask, setEditingTask] = useState(null);
  const [proposal, setProposal] = useState(null);

  const [activity, setActivity] = useState(() => {
  try {
    const saved = localStorage.getItem("taskpilot_activity");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
});

  useEffect(() => {
    loadTasks();
  }, []);
  
 const addActivity = (type, text) => {
  const newActivity = {
    id: Date.now(),
    type,
    text,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  setActivity((current) => {
    const updated = [newActivity, ...current].slice(0, 10);

    localStorage.setItem(
      "taskpilot_activity",
      JSON.stringify(updated)
    );

    return updated;
  });
};

  const loadTasks = async () => {
    try {
      const response = await fetch(`${API}/tasks/`);
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error(error);
      setMessage("Could not load tasks.");
    }
  };

  // ==========================================
  // ASK AI - AGENT DECISION
  // ==========================================

  const analyzeTask = async () => {
    if (!request.trim()) {
      setMessage("Please enter a task.");
      return;
    }

    setLoading(true);
    setMessage("");
    setProposal(null);

    try {
      const response = await fetch(`${API}/tasks/agent/decide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request: request,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "AI decision failed");
      }

      setProposal(data.decision);
      addActivity(
  "proposal",
  `AI proposed: ${data.decision.action.toUpperCase()}`
);
      setMessage("AI has proposed an action. Please review it.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // APPROVE AI ACTION
  // ==========================================

  const approveProposal = async () => {
    if (!proposal) return;

    setLoading(true);
    setMessage("");

    try {
      let taskData = null;

      if (proposal.task) {
        taskData = {
          title: proposal.task.title,
          description: request,
          priority: proposal.task.priority,
          deadline: proposal.task.deadline,
          action_plan: proposal.task.action_plan
            .map((step, index) => `${index + 1}. ${step}`)
            .join("\n"),
        };
      }

      const response = await fetch(`${API}/tasks/agent/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approved: true,
          action: proposal.action,
          task_id: proposal.task_id,
          task: taskData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not approve action");
      }

      if (proposal.action === "create" && data.task) {
        setTasks((currentTasks) => [
          data.task,
          ...currentTasks,
        ]);
      }

      if (proposal.action === "list" && data.tasks) {
        setTasks(data.tasks);
      }
      
      addActivity(
  "approved",
  `Approved: ${proposal.action.toUpperCase()}`
);

      setProposal(null);
      setRequest("");

      setMessage(
        data.message || "Action approved successfully."
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // REJECT AI ACTION
  // ==========================================

 const rejectProposal = () => {
  if (proposal) {
    addActivity(
      "rejected",
      `Rejected: ${proposal.action.toUpperCase()}`
    );
  }

  setProposal(null);
  setMessage("AI action rejected.");
};

  // ==========================================
  // COMPLETE TASK
  // ==========================================

  const completeTask = async (id) => {
    try {
      const response = await fetch(`${API}/tasks/${id}/complete`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Could not complete task.");
      }

      const updatedTask = await response.json();

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === id ? updatedTask : task
        )
      );

      setMessage("Task completed.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  // ==========================================
  // DELETE TASK
  // ==========================================

  const deleteTask = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this task?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API}/tasks/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Could not delete task.");
      }

      setTasks((currentTasks) =>
        currentTasks.filter((task) => task.id !== id)
      );

      setMessage("Task deleted.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  // ==========================================
  // UPDATE TASK
  // ==========================================

  const updateTask = async () => {
    if (!editingTask.title.trim()) {
      setMessage("Task title cannot be empty.");
      return;
    }

    try {
      const response = await fetch(
        `${API}/tasks/${editingTask.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: editingTask.title,
            description: editingTask.description,
            priority: editingTask.priority,
            deadline: editingTask.deadline,
            action_plan: editingTask.action_plan,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Could not update task.");
      }

      const updatedTask = await response.json();

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === updatedTask.id
            ? updatedTask
            : task
        )
      );

      setEditingTask(null);
      setMessage("Task updated successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const activeTasks = tasks.filter(
    (task) => task.status !== "Completed"
  );

  const completedTasks = tasks.filter(
    (task) => task.status === "Completed"
  );

  return (
    <div className="app">

      {/* ==========================================
          NAVBAR
      ========================================== */}

      <header className="navbar">
        <div className="logo">
          <span>✦</span> TaskPilot AI
        </div>

        <div className="status">
          <span className="status-dot"></span>
          AI Agent Online
        </div>
      </header>


      <main className="dashboard">

        {/* ==========================================
            WELCOME
        ========================================== */}

        <section className="welcome">
          <div>
            <p className="eyebrow">
              AI TASK MANAGEMENT
            </p>

            <h1>
              Your personal
              <br />
              <span>AI task agent.</span>
            </h1>

            <p className="welcome-text">
              Describe what you need to accomplish.
              TaskPilot will understand your request,
              propose an action, and let you approve it.
            </p>
          </div>
        </section>


        {/* ==========================================
            AI BOX
        ========================================== */}

        <section className="ai-box">

          <div className="ai-title">

            <div className="ai-icon">
              ✦
            </div>

            <div>
              <h2>Ask TaskPilot</h2>

              <p>
                Tell the AI what you want to accomplish.
              </p>
            </div>

          </div>


          <textarea
            value={request}
            onChange={(e) =>
              setRequest(e.target.value)
            }
            placeholder="Example: Tomorrow I need to finish my Python project and prepare for my internship interview..."
          />


          <button
            className="ai-button"
            onClick={analyzeTask}
            disabled={loading}
          >
            {loading
              ? "AI is thinking..."
              : "✦ Ask AI"}
          </button>


          {message && (
            <div className="message">
              {message}
            </div>
          )}

        </section>


        {/* ==========================================
            AI PROPOSAL
        ========================================== */}

        {proposal && (
          <section className="proposal-card">

            <div className="proposal-header">

              <div>
                <p className="eyebrow">
                  AI PROPOSAL
                </p>

                <h2>
                  Review AI Action
                </h2>
              </div>

              <span className="proposal-action">
                {proposal.action.toUpperCase()}
              </span>

            </div>


            <div className="proposal-reason">

              <strong>
                Why AI chose this:
              </strong>

              <p>
                {proposal.reason}
              </p>

            </div>


            {proposal.task && (
              <div className="proposal-task">

                <h3>
                  {proposal.task.title}
                </h3>

                <div className="proposal-info">

                  <span>
                    Priority:{" "}
                    <strong>
                      {proposal.task.priority}
                    </strong>
                  </span>

                  <span>
                    Deadline:{" "}
                    <strong>
                      {proposal.task.deadline}
                    </strong>
                  </span>

                </div>


                <div className="proposal-plan">

                  <h4>
                    AI Action Plan
                  </h4>

                  {proposal.task.action_plan.map(
                    (step, index) => (
                      <div
                        className="action-step"
                        key={index}
                      >
                        <span>
                          {index + 1}
                        </span>

                        <p>
                          {step}
                        </p>
                      </div>
                    )
                  )}

                </div>

              </div>
            )}


            <div className="approval-actions">

              <button
                className="approve-btn"
                onClick={approveProposal}
                disabled={loading}
              >
                ✓ Approve & Execute
              </button>

              <button
                className="reject-btn"
                onClick={rejectProposal}
                disabled={loading}
              >
                ✕ Reject
              </button>

            </div>

          </section>
        )}


        {/* ==========================================
            STATS
        ========================================== */}

        <section className="stats">

        <section className="activity-section">

  <div className="section-header">

    <div>
      <p className="eyebrow">
        AGENT MONITOR
      </p>

      <h2>
        Agent Activity
      </h2>
    </div>

    {activity.length > 0 && (
      <button
        className="refresh-button"
        onClick={() => {
          setActivity([]);
          localStorage.removeItem(
            "taskpilot_activity"
          );
        }}
      >
        Clear
      </button>
    )}

  </div>


  {activity.length === 0 ? (

    <div className="activity-empty">
      <span>✦</span>

      <p>
        No agent activity yet.
      </p>

    </div>

  ) : (

    <div className="activity-list">

      {activity.map((item) => (

        <div
          className={`activity-item ${item.type}`}
          key={item.id}
        >

          <div className="activity-icon">

            {item.type === "approved"
              ? "✓"
              : item.type === "rejected"
              ? "✕"
              : "✦"}

          </div>


          <div className="activity-content">

            <strong>
              {item.text}
            </strong>

            <span>
              {item.time}
            </span>

          </div>

        </div>

      ))}

    </div>

  )}

</section>

          <div className="stat-card">
            <span>Total Tasks</span>
            <strong>
              {tasks.length}
            </strong>
          </div>

          <div className="stat-card">
            <span>Active</span>
            <strong>
              {activeTasks.length}
            </strong>
          </div>

          <div className="stat-card">
            <span>Completed</span>
            <strong>
              {completedTasks.length}
            </strong>
          </div>

        </section>


        {/* ==========================================
            TASKS
        ========================================== */}

        <section className="tasks-section">

          <div className="section-header">

            <div>
              <p className="eyebrow">
                WORKSPACE
              </p>

              <h2>
                My Tasks
              </h2>
            </div>

            <button
              className="refresh-button"
              onClick={loadTasks}
            >
              ↻ Refresh
            </button>

          </div>


          {tasks.length === 0 ? (

            <div className="empty">

              <div className="empty-icon">
                ✓
              </div>

              <h3>
                No tasks yet
              </h3>

              <p>
                Ask TaskPilot to create your first task.
              </p>

            </div>

          ) : (

            <div className="task-list">

              {tasks.map((task) => (

                <div
                  className={`task-card ${
                    task.status === "Completed"
                      ? "completed"
                      : ""
                  }`}
                  key={task.id}
                >

                  <div className="task-top">

                    <div className="task-main">

                      <div className="task-check">
                        {task.status === "Completed"
                          ? "✓"
                          : "○"}
                      </div>

                      <div>

                        <h3>
                          {task.title}
                        </h3>

                        <p className="description">
                          {task.description}
                        </p>

                      </div>

                    </div>


                    <span
                      className={`priority ${
                        task.priority.toLowerCase()
                      }`}
                    >
                      {task.priority}
                    </span>

                  </div>


                  <div className="task-info">

                    <span>
                      Deadline:{" "}
                      <strong>
                        {task.deadline ||
                          "Not specified"}
                      </strong>
                    </span>

                    <span>
                      Status:{" "}
                      <strong>
                        {task.status}
                      </strong>
                    </span>

                    <span>
                      ID:{" "}
                      <strong>
                        #{task.id}
                      </strong>
                    </span>

                  </div>


                  {task.action_plan && (

                    <div className="action-plan">

                      <h4>
                        AI Action Plan
                      </h4>

                      {task.action_plan
                        .split("\n")
                        .filter(Boolean)
                        .map(
                          (step, index) => (

                            <div
                              className="action-step"
                              key={index}
                            >

                              <span>
                                {index + 1}
                              </span>

                              <p>
                                {step.replace(
                                  /^\d+\.\s*/,
                                  ""
                                )}
                              </p>

                            </div>

                          )
                        )}

                    </div>

                  )}


                  <div className="task-actions">

                    {task.status !== "Completed" && (

                      <button
                        className="complete-btn"
                        onClick={() =>
                          completeTask(task.id)
                        }
                      >
                        ✓ Complete
                      </button>

                    )}


                    <button
                      className="edit-btn"
                      onClick={() =>
                        setEditingTask({
                          ...task,
                        })
                      }
                    >
                      ✎ Edit
                    </button>


                    <button
                      className="delete-btn"
                      onClick={() =>
                        deleteTask(task.id)
                      }
                    >
                      🗑 Delete
                    </button>

                  </div>

                </div>

              ))}

            </div>

          )}

        </section>

      </main>


      {/* ==========================================
          EDIT MODAL
      ========================================== */}

      {editingTask && (

        <div className="modal-overlay">

          <div className="modal">

            <div className="modal-header">

              <div>

                <p className="eyebrow">
                  EDIT TASK
                </p>

                <h2>
                  Update Task
                </h2>

              </div>

              <button
                className="close-btn"
                onClick={() =>
                  setEditingTask(null)
                }
              >
                ×
              </button>

            </div>


            <label>
              Title
            </label>

            <input
              value={editingTask.title}
              onChange={(e) =>
                setEditingTask({
                  ...editingTask,
                  title: e.target.value,
                })
              }
            />


            <label>
              Description
            </label>

            <textarea
              value={editingTask.description}
              onChange={(e) =>
                setEditingTask({
                  ...editingTask,
                  description: e.target.value,
                })
              }
            />


            <label>
              Priority
            </label>

            <select
              value={editingTask.priority}
              onChange={(e) =>
                setEditingTask({
                  ...editingTask,
                  priority: e.target.value,
                })
              }
            >
              <option value="Low">
                Low
              </option>

              <option value="Medium">
                Medium
              </option>

              <option value="High">
                High
              </option>
            </select>


            <label>
              Deadline
            </label>

            <input
              value={
                editingTask.deadline || ""
              }
              onChange={(e) =>
                setEditingTask({
                  ...editingTask,
                  deadline: e.target.value,
                })
              }
            />


            <button
              className="save-btn"
              onClick={updateTask}
            >
              Save Changes
            </button>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;

