import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { superAdminClasses } from "../data/superAdminCatalog";
import { useAdminActions, useSubjects, useUsers } from "../hooks/useLmsQueries";
import type { Role, User } from "../types";

interface Props {
  user: User;
}

const roleOptions: Role[] = [
  "regular_student",
  "administrative_student",
  "specialized_teacher",
  "main_teacher",
];

type AdminTab = "pending" | "teachers" | "students" | "classes";

const tabOptions: Array<{ id: AdminTab; label: string }> = [
  { id: "pending", label: "Pending Approvals" },
  { id: "teachers", label: "Teachers" },
  { id: "students", label: "Students" },
  { id: "classes", label: "Classes" },
];

export function SuperAdminPage({ user }: Props) {
  const users = useUsers();
  const subjects = useSubjects(user);
  const actions = useAdminActions(user);
  const [subjectId, setSubjectId] = useState("sub-english");
  const [teacherId, setTeacherId] = useState("u-spec-eng");
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get("tab") as AdminTab | null) ?? "pending";
  const safeTab = tabOptions.some((tab) => tab.id === activeTab) ? activeTab : "pending";

  const pendingUsers = (users.data ?? []).filter((candidate) => !candidate.approved);
  const teacherUsers = (users.data ?? []).filter(
    (candidate) =>
      candidate.role === "main_teacher" || candidate.role === "specialized_teacher",
  );
  const studentUsers = (users.data ?? []).filter(
    (candidate) =>
      candidate.role === "regular_student" || candidate.role === "administrative_student",
  );
  const subjectCountByClass = useMemo(() => {
    const map = new Map<string, number>();
    (subjects.data ?? []).forEach((subject) => {
      map.set(subject.classId, (map.get(subject.classId) ?? 0) + 1);
    });
    return map;
  }, [subjects.data]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p>Manage users, roles, and assignments</p>
      </div>

      <div className="pill-nav">
        {tabOptions.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={safeTab === tab.id ? "active" : ""}
            onClick={() => setSearchParams({ tab: tab.id })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {safeTab === "pending" && (
        <article className="panel">
          <h2>Pending User Approvals</h2>
          <p>Review and approve new user registrations</p>
          {pendingUsers.length === 0 ? (
            <p>No pending approvals</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Class</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((candidate) => (
                  <tr key={candidate._id}>
                    <td>{candidate.name}</td>
                    <td>{candidate.role}</td>
                    <td>{candidate.classId}</td>
                    <td>
                      <button onClick={() => actions.approve.mutate(candidate._id)}>
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      )}

      {safeTab === "teachers" && (
        <article className="panel">
          <h2>Teacher Management</h2>
          <p>Manage teacher roles, classes, and subject assignments</p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Class</th>
                <th>Subjects</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teacherUsers.map((teacher) => (
                <tr key={teacher._id}>
                  <td>{teacher.name}</td>
                  <td>{teacher.role}</td>
                  <td>{teacher.classId}</td>
                  <td>{(teacher.subjectIds ?? []).join(", ") || "-"}</td>
                  <td className="button-row">
                    <select
                      defaultValue={teacher.role}
                      onChange={(event) =>
                        actions.assignRole.mutate({
                          userId: teacher._id,
                          role: event.target.value as Role,
                        })
                      }
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              actions.assignSubject.mutate({ subjectId, teacherId });
            }}
          >
            <h3>Assign Subject Owner</h3>
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              {(subjects.data ?? []).map((subject) => (
                <option key={subject._id} value={subject._id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <select
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              {teacherUsers.map((teacher) => (
                <option key={teacher._id} value={teacher._id}>
                  {teacher.name}
                </option>
              ))}
            </select>
            <button type="submit">Assign</button>
          </form>
        </article>
      )}

      {safeTab === "students" && (
        <article className="panel">
          <h2>Student Management</h2>
          <p>Manage student class assignments and administrative privileges</p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Class</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {studentUsers.map((candidate) => (
                <tr key={candidate._id}>
                  <td>{candidate.name}</td>
                  <td>{candidate.role}</td>
                  <td>{candidate.classId}</td>
                  <td className="button-row">
                    <select
                      defaultValue={candidate.role}
                      onChange={(event) =>
                        actions.assignRole.mutate({
                          userId: candidate._id,
                          role: event.target.value as Role,
                        })
                      }
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}

      {safeTab === "classes" && (
        <article className="panel">
          <h2>Classes</h2>
          <p>School class groups and assigned main teachers</p>
          <div className="classes-grid">
            {superAdminClasses.map((classItem) => (
              <article key={classItem.id} className="item-card">
                <h3>{classItem.label}</h3>
                <p>Main Teacher: {classItem.mainTeacher}</p>
                <small>31 students</small>
                <small>
                  {subjectCountByClass.get(classItem.id) ?? (classItem.id === "class-1A" ? 6 : 0)}{" "}
                  subjects
                </small>
              </article>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}
