export function createFreeResponsePrompt(content: string, setName: string): string {
  return `You are an expert educator tasked with creating high-quality free response questions with detailed rubrics for studying. Your goal is to create questions that promote deep understanding and critical thinking with clear grading criteria.

**Guidelines:**
- Create 5-10 free response questions based on the provided content
- Questions should require explanatory answers (not simple yes/no or single word answers)
- Include a mix of difficulty levels: some easier recall questions and some higher-order thinking questions
- Questions should be specific enough to have clear, correct answers
- Each answer should be 2-4 sentences long and cover the key concepts
- Avoid questions that are too broad or too narrow
- Focus on the most important concepts and ideas

**Question Types to Include:**
- Explain concepts: "Explain how/why..."
- Compare/contrast: "Compare and contrast..."
- Analyze relationships: "Analyze the relationship between..."
- Apply knowledge: "How would you apply..."
- Evaluate: "Evaluate the effectiveness of..."

**Rubric Requirements:**
- Create exactly 4 specific grading criteria tailored to each individual question
- Each criterion should test a specific concept, fact, or skill that the question requires
- Each criterion is worth exactly 1 point (binary: met or not met)
- Be generous - if a student shows understanding, they should get credit
- Criteria should be directly related to the subject matter and question content
- Do NOT use generic criteria like "Clear Expression" - make them content-specific

**Output Format:**
Return a JSON array of objects with the following structure:
[
  {
    "question": "Explain the process of photosynthesis and identify its main components",
    "answer": "Photosynthesis is the process where plants convert light energy, carbon dioxide, and water into glucose and oxygen using chlorophyll in the chloroplasts",
    "rubric": [
      {
        "criterion": "Identifies CO2 and water as reactants",
        "points": 1
      },
      {
        "criterion": "Mentions light energy requirement",
        "points": 1
      },
      {
        "criterion": "States glucose and oxygen as products",
        "points": 1
      },
      {
        "criterion": "References chlorophyll or chloroplasts",
        "points": 1
      }
    ]
  }
]

**Content to analyze:**
${content}

**Set Name:** ${setName}

Generate thoughtful free response questions with specific, content-focused rubrics. Each rubric criterion should test a particular fact, concept, or skill that the question requires - NOT generic writing skills.

Examples of GOOD criteria (specific to content):
- "Identifies the correct time period (1914-1918)"
- "Names at least two causes of the war"
- "Mentions trench warfare tactics"

Examples of BAD criteria (generic):
- "Shows good understanding"
- "Answer is complete"  
- "Uses clear language"

Make each criterion specific to what knowledge the question is testing.`
}

export function createFreeResponseEvaluationPrompt(
  question: string,
  expectedAnswer: string,
  userAnswer: string,
  rubric: Array<{ criterion: string; points: number }>
): string {
  return `You are an expert educator tasked with grading a student's free response answer using a specific rubric. Be moderately generous but fair in your scoring.

**Question:** ${question}

**Expected/Model Answer:** ${expectedAnswer}

**Student's Answer:** ${userAnswer}

**Grading Rubric:**
${rubric
  .map(
    (criterion, index) => `
${index + 1}. **${criterion.criterion}** (${criterion.points} points)
`
  )
  .join('')}

**Instructions:**
- Grade each criterion as either MET (1 point) or NOT MET (0 points) - no partial credit
- Be generous - if a student shows reasonable understanding, give them the point
- Each criterion is worth exactly 1 point, for a total of 4 points possible
- Provide specific, constructive feedback that directly references what the student wrote
- Point out specific strengths in the student's response (exact phrases or concepts they used well)
- For improvements, be specific about what the student missed compared to the expected answer
- Quote or reference specific parts of the student's answer in your feedback when possible
- Compare the student's response directly to the expected answer, highlighting both similarities and differences
- Score = (points earned / 4) × 100% for the percentage

**Output Format:**
Return a JSON object with the following structure:
{
  "totalScore": 3,
  "percentage": 75,
  "isCorrect": true,
  "criteriaScores": [
    {
      "criterion": "Correct Understanding",
      "pointsEarned": 1,
      "pointsPossible": 1,
      "feedback": "✓ Met - Your explanation correctly identifies the basic process of photosynthesis"
    },
    {
      "criterion": "Complete Answer", 
      "pointsEarned": 1,
      "pointsPossible": 1,
      "feedback": "✓ Met - You addressed the main aspects of the question"
    },
    {
      "criterion": "Clear Expression",
      "pointsEarned": 1,
      "pointsPossible": 1,
      "feedback": "✓ Met - Your answer was clearly written and easy to understand"
    },
    {
      "criterion": "Good Examples",
      "pointsEarned": 0,
      "pointsPossible": 1,
      "feedback": "✗ Not Met - Could include more specific details about chlorophyll or light energy"
    }
  ],
  "overallFeedback": "Your response shows good understanding of the main concept when you wrote 'plants convert carbon dioxide into oxygen.' However, you could strengthen your answer by explaining the role of chlorophyll and light energy, which the expected answer emphasizes.",
  "keyStrengths": ["Correctly identified CO2 as a reactant", "Understood the basic conversion process", "Used appropriate scientific terminology"],
  "areasForImprovement": ["Include the role of light energy in the process", "Mention chlorophyll's function", "Explain where the process occurs (chloroplasts)"]
}

Grade the student's response now, being fair but generous when appropriate.`
}
