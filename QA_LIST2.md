Fix and improvements that you should add

Most of the application logic is almost wrong due to relational database mistake between subjects and teachers.

Database
1. A teacher could teach so many classes in the subject they are teaching, but they can only have one or no main class. 
2. A subject could have so many teachers, while a teacher could only have a subject.
3. A main teacher should atleast be a subject teacher too, but a subject teacher can optionally be a main teacher or no.
4. An admin student must be atleast a regular student. A regular student can be a an admin student or not at all.

Seeder
1. Update the seed of the class to have 9 classes (3 classes with the names of A, B, and C each batch, and sequenced from 1, 2 to 3. E.g. 1A, 2B, 3C)
2. Provide wide submissions with ungraded and graded scores from different users
3. Provide atleast 10 students from each class and 2 admin students each class. 
4. Provide 12 teachers (9 main teachers and 12 literally subject teachers). It's definitely okay to have a subject with multiple teachers and teachers can have some classes that they can teach.
5. Add new classId in users for the teachers to teach some classes and its optional. If you think there is a best approach for this, you can use your own way to specify the classes that the teachers teach.
6. Provide assignments at least one from each teacher.
7. 

Logic for Dashboard page
1. Make a break line between the main class summary (grade, attendance, students in class) and the taught classes (upcoming assignments and the pending grading).
2. Add recent announcements for teacher's page too.
3. Make breadcrumb
4.

Logic for Assignments page
1. Add hover effect when you hover the view submission button, and when you pressed it, make the table of submissions have an slight and fast indicator of changing table, like the color of the table would be gray in a second and it will fade to original color, so the user would know that the table of the submissions have been changed
2. Change the tabs to classes tabs of the classes that the teacher's teach.
3. Fix the blank assignment lists shown on the student's page. Show some sort of indicators that you pressed an assignment and showing the table of the details of the assignments.
4. For the teacher, make sure that they can see the details of each student's submission when they press a student's work, by redirecting it to the student's submission page.


Logic for Ranking page
1. A subject teacher could see the ranking grades of their subjects in each class they are teaching, but could not see the ranking of the other subjects they don't teach.
2. A main teacher could see the overall subject and each of subjects ranking of their class. A main teacher is also a subject teacher, which means they could see the ranking of each class they are teaching but limited to their own subject, not the overall or the other subjects that they don't teach.
3. Provide the class name above the main class table in the main class tab
4. Provide the class options above the subject ranking by class table
5. Change the name of the tab from "Subject Ranking By Class" to dynamic "Your {subject} Classes Rankings"
6. Remove the options of the subjects tabs in the Your Subject Classes Rankings because each teacher only has one subject.
7. In the teacher's subject tab, make sure that to change the class ranking data each time you press different class tab.

Logic for Attendance page
1. In the subject attendance, change the subject options to classes options that the teacher teaches. 
2. Add arrows around the date option to make it easier to move to previous date and next date.
3. Make sure teacher has checked all of the status of the students in their classes and then they can save the attendance list. After they save the attendance list, they can actually revise it if they did something wrong to when listing the attendance, but show that the attendance list has been saved.
4. Make sure when teacher chooses another class, the page changes and shows the data of the students that the teacher chooses.

Logic for Announcements page
