export interface BatchClass {
  id: string;
  label: string;
  batch: "1st" | "2nd" | "3rd";
  mainTeacher: string;
}

export const superAdminClasses: BatchClass[] = [
  { id: "class-1A", label: "Class 1A", batch: "1st", mainTeacher: "Mrs. Johnson" },
  { id: "class-1B", label: "Class 1B", batch: "1st", mainTeacher: "Mr. Williams" },
  { id: "class-1C", label: "Class 1C", batch: "1st", mainTeacher: "Ms. Davis" },
  { id: "class-2A", label: "Class 2A", batch: "2nd", mainTeacher: "Dr. Martinez" },
  { id: "class-2B", label: "Class 2B", batch: "2nd", mainTeacher: "Mrs. Garcia" },
  { id: "class-2C", label: "Class 2C", batch: "2nd", mainTeacher: "Mr. Rodriguez" },
  { id: "class-3A", label: "Class 3A", batch: "3rd", mainTeacher: "Ms. Lee" },
  { id: "class-3B", label: "Class 3B", batch: "3rd", mainTeacher: "Dr. Brown" },
  { id: "class-3C", label: "Class 3C", batch: "3rd", mainTeacher: "Mrs. Taylor" },
];

export const batches: Array<BatchClass["batch"]> = ["1st", "2nd", "3rd"];
