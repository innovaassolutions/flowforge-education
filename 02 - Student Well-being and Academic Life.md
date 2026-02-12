**Student Wellbeing & Academic Life Module**

**STUDENT Question Bank (with all the relationship dynamics + curriculum)**

  

Here’s a clean v1.0 Todd can literally turn into JSON, DB rows, or prompt templates.

**A. Academic_Life**

  

- How fair do you feel your teachers are in grading your work?
    
- Do you feel you understand what is expected of you in your subjects?
    
- How often do you feel you are learning something meaningful in class?
    
- Are Lessons engaging?
    
- Are teachers fair and supportive?
    

  

**B. Curriculum_Experience**

  

(for IB, IGCSE, A Levels, AP, etc.)

  

First, collect context (metadata, not just survey):

  

Which programme are you currently in?

  

☐ IB PYP

  

☐ IB MYP

  

☐ IB DP

  

☐ IGCSE

  

☐ A Levels

  

☐ AP

  

☐ National curriculum

  

☐ Other: _______

  

Then ask:

  

- How challenging do you find your current programme?
    

  

- Does the programme allow you enough time for rest, hobbies, or family?
    

  

- Do you feel the subjects you are studying are relevant to your future?
    

  

- Do you feel the way you are assessed (tests, projects, exams) is fair?
    

  

- How often does your programme make you feel overly stressed?
    

  

- (These can be Likert + 1–2 open-ended.)
    

  

**C. Peer_Relationships (student ↔ student)**

  

- Do you feel you have close friends at school?
    

  

- Do you feel accepted by your classmates?
    

  

- Have you experienced bullying (in person or online) from other students this year?
    

  

- If something bad happened with another student, do you feel the school would handle it fairly?
    

  

- “I feel safe around other students at this school.” (agree/disagree)
    

  

**D. Student_Teacher_Relationships**

  

- Do you feel your teachers respect you as a person?
    

  

- Do you feel comfortable asking teachers for help when you don’t understand something?
    

  

- Do your teachers listen when you share your ideas or concerns?
    

  

- Have you ever felt unfairly treated by a teacher? (Yes/No + optional “Can you tell us more?”)
    

  

- “I feel at least one teacher at this school genuinely cares about me.”
    

  

**E. Student_Staff_Relationships (non-teaching staff)**

  

- Are non-teaching staff (office, security, cleaners, canteen, etc.) generally respectful to students?
    

  

- Do you feel comfortable asking non-teaching staff for assistance if you need help?
    

  

- “I feel students treat non-teaching staff with respect at this school.”
    

  

- (This gives insight into school-wide culture, not just classrooms.)
    

  

**F. Student_Leadership_Perception**

  

- Do you know who the principal / senior leaders are?
    

  

- Do you feel school leaders care about students’ wellbeing?
    

  

- Do you feel leadership listens to student feedback (e.g. through councils, surveys)?
    

  

- “If I had a serious problem, I believe leadership would take it seriously.”
    

  

- “I trust the decisions made by school leadership.”
    

  

**G. Wellbeing_Safety**

  

- Do you feel safe at school most of the time?
    

  

- Do you know who to talk to if you feel anxious, sad, or unsafe?
    

  

- Have you ever avoided school because of how it makes you feel?
    

  

- How often do you feel overwhelmed by school (academic or social)?
    

  

- “I feel my mental health is taken seriously at this school.”
    

  

**H. Facilities**

  

- How would you rate the cleanliness of school facilities (toilets, common areas)?
    

  

- How would you rate the library / study spaces?
    

  

- How would you rate sports and recreation spaces?
    
      
    
- What else do you think needs improvement or addition to school facilities?
    

  

**I. Emotional_Psychology (the Malcolm-style layer)**

  

- These are the ones that give the LLM deep signal:
    

  

- “I feel I can be myself at this school.”
    

  

- “I feel seen and understood by at least one adult at school.”
    

  

- “I feel hopeful about my future when I think about school.”
    

  

- “Sometimes I feel invisible here.” (reverse indicator)
    

  

- “There is at least one safe person I can go to if something is wrong.”
    

  

All of those can be Likert (Strongly agree → Strongly disagree) with optional open comment.

  

**3️⃣ How to Handle Curriculum (IB, British, AP, etc.) in the System**

  

You’re 100% right to ask this – curriculum is hugely linked to stress, parent perception, teacher workload, AND student experience.

  

I’d recommend Todd models it in two layers:

🔹 A. Curriculum_Context (Metadata Layer)

  

This is not a “module” the user sees; it’s background data the LLM uses.

  

For each student / parent / teacher response, attach

  

{

  "curriculum_programme": "IB_DP",       // or MYP, PYP, IGCSE, ALEVEL, AP, etc.

  "year_level": "Year_11",

  "subject_load": 7,                     // no. of subjects

  "high_stakes_exam_year": true/false

}

  

This allows FlowForge to later say things like:

  

“Stress indicators were significantly higher among IB DP and IGCSE exam-year students.”

  

“Students in A Levels report more relevance but also more pressure.”

  

🔹 **B. Curriculum_Experience (Dimension in Multiple Modules)**

  

Instead of one big curriculum module, we treat curriculum as a cross-cutting experience:

  

In Student_Experience_Module → Curriculum_Experience (what we just did)

  

In Teacher_Climate_Module (questions like “Is the curriculum realistically deliverable?”, “Do you feel pressured by external exam standards?”)

  

In Parent_Experience_Module (questions like “Does the curriculum match your expectations?”, “Do you feel your child is over/under challenged?”)

  

So in the data model:

  

Parent_Experience_Module

  └── Curriculum_Experience (parent view)

  

Teacher_Climate_Module

  └── Curriculum_Experience (teacher view)

  

Student_Experience_Module

  └── Curriculum_Experience (student view)

  

+ Curriculum_Context (programme metadata, shared)

  

  

This way, Todd’s LLM can triangulate:

  

How students feel about IB vs IGCSE

  

How parents perceive rigor vs wellbeing

  

How teachers experience delivery pressure

  

…and expose that as patterns in the dashboards.

  

4️⃣ For Todd – how the LLM should use this

  

If you want to literally give him language:

  

“Student_Experience_Module must explicitly model relationship dynamics (student–student, student–teacher, student–staff, student–leadership) plus curriculum experience. Each dimension gets a small question bank (Likert + open-ended). The LLM’s job is not to write the questions but to:

– cluster responses into themes,

– detect risk (e.g., bullying, mistrust of leadership),

– correlate with curriculum programme metadata, and

– generate human-readable insights & recommendations.”

  

That tells him exactly what to design for.