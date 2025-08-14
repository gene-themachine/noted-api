export function createFreeResponsePrompt(content: string, setName: string): string {
  return `You are an expert educator tasked with creating high-quality free response questions for studying. Your goal is to create questions that promote deep understanding and critical thinking.

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

**Output Format:**
Return a JSON array of objects with the following structure:
[
  {
    "question": "The question text here",
    "answer": "The expected answer here (2-4 sentences covering key points)"
  }
]

**Content to analyze:**
${content}

**Set Name:** ${setName}

Generate thoughtful free response questions that will help students demonstrate their understanding of these concepts. Focus on questions that require explanation, analysis, and critical thinking rather than simple recall.`
}