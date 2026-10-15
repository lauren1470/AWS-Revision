import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceFolderName = 'cloud-practioner-exam-src'
const sourceDirectory = path.join(root, 'practice-exam-src', sourceFolderName)
const outputFile = path.join(root, 'src', 'data', 'generatedPracticeExams.ts')
const cloudPractitionerId = 'aws-certified-cloud-practitioner'
const subjectAreaMatchers = [
  ['Identity and access management (IAM)', /\b(iam|identity|access control|permission|policy|role|mfa|password|credential|root user|authorization)\b/i],
  ['Security and compliance', /\b(security|encrypt|encryption|compliance|waf|shield|guardduty|inspector|kms|certificate|audit|pci|gdpr|ddos)\b/i],
  ['Compute', /\b(ec2|lambda|elastic beanstalk|fargate|ecs|eks|auto scaling|container|serverless|instance)\b/i],
  ['Storage', /\b(s3|storage|ebs|efs|fsx|glacier|backup|archive|object storage)\b/i],
  ['Networking and content delivery', /\b(vpc|network|route|dns|cloudfront|direct connect|transit gateway|load balancer|elastic load|availability zone|region|internet gateway|nat gateway)\b/i],
  ['Databases and analytics', /\b(rds|dynamodb|database|redshift|aurora|elasticache|athena|emr|kinesis|data warehouse)\b/i],
  ['Management and monitoring', /\b(cloudwatch|cloudtrail|config|systems manager|trusted advisor|well-architected|cloudformation|organizations|control tower|opsworks)\b/i],
  ['Pricing, billing, and support', /\b(pricing|price|cost|billing|budget|savings|reserved instance|support plan|support case|tco|invoice|payment)\b/i],
]

function cleanHtml(value) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractExplanation(content) {
  const match = content.match(/Explanation:\s*([\s\S]*?)\s*$/i)
  return match ? cleanHtml(match[1]) : undefined
}

function classifySubjectArea(questionText, choices) {
  const searchable = `${questionText} ${choices.map((choice) => choice.label).join(' ')}`
  return subjectAreaMatchers.find(([, matcher]) => matcher.test(searchable))?.[0] ?? 'Cloud concepts and migration'
}

function parseQuestion(block, fileName, number) {
  const questionMatch = block.match(/^(\d+)\.\s+([\s\S]*?)\s+-\s*A\.\s/m)
  if (!questionMatch) {
    throw new Error(`${fileName}: could not parse question ${number}`)
  }

  const detailStart = block.indexOf('<details')
  const choicesStart = questionMatch.index + questionMatch[0].lastIndexOf('- A.')
  const beforeDetails = block.slice(choicesStart, detailStart)
  const choices = [...beforeDetails.matchAll(/^\s*-\s*([A-Z])\.\s+([\s\S]*?)(?=^\s*-\s*[A-Z]\.\s+|$)/gm)].map(
    ([, id, label]) => ({ id, label: cleanHtml(label) }),
  )
  const answerMatch = block.match(/Correct Answer:\s*([A-Z]+(?:\s*,\s*[A-Z]+)*)/i)

  if (choices.length < 2 || !answerMatch) {
    throw new Error(`${fileName}: question ${number} is missing choices or a correct answer`)
  }

  const correctOptionIds = answerMatch[1].toUpperCase().match(/[A-Z]/g) ?? []
  if (correctOptionIds.some((id) => !choices.some((choice) => choice.id === id))) {
    throw new Error(`${fileName}: question ${number} has an answer that is not an option`)
  }

  return {
    id: `cloud-practitioner-${path.basename(fileName, '.md')}-q${number}`,
    certificationId: cloudPractitionerId,
    sourceExamId: `cloud-practitioner-${path.basename(fileName, '.md')}`,
    sourceQuestionNumber: number,
    prompt: cleanHtml(questionMatch[2]),
    options: choices,
    correctOptionIds,
    explanation: extractExplanation(block.slice(detailStart)),
    subjectArea: classifySubjectArea(questionMatch[2], choices),
  }
}

function parseExam(source, fileName) {
  const titleMatch = source.match(/^#\s+(.+)$/m)
  if (!titleMatch) {
    throw new Error(`${fileName}: missing exam title`)
  }

  const blocks = [...source.matchAll(/^(\d+)\.\s+[\s\S]*?<\/details>/gm)].map((match) => match[0])
  if (!blocks.length) {
    throw new Error(`${fileName}: contains no questions`)
  }

  const questions = blocks.map((block, index) => parseQuestion(block, fileName, index + 1))
  return {
    id: `cloud-practitioner-${path.basename(fileName, '.md')}`,
    certificationId: cloudPractitionerId,
    title: titleMatch[1].trim(),
    sourceFile: `practice-exam-src/${sourceFolderName}/${fileName}`,
    questionIds: questions.map((question) => question.id),
    questions,
  }
}

const files = (await readdir(sourceDirectory))
  .filter((file) => /^practice-exam-\d+\.md$/.test(file))
  .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]))

const exams = await Promise.all(
  files.map(async (file) => parseExam(await readFile(path.join(sourceDirectory, file), 'utf8'), file)),
)

const totalQuestions = exams.reduce((total, exam) => total + exam.questions.length, 0)
if (totalQuestions !== 1142) {
  throw new Error(`Expected 1,142 Cloud Practitioner questions but parsed ${totalQuestions}`)
}

await mkdir(path.dirname(outputFile), { recursive: true })
await writeFile(
  outputFile,
  `// Generated by scripts/generate-practice-exams.mjs. Do not edit manually.\n` +
    `import type { PracticeExam, Question } from '../lib/types'\n\n` +
    `export const generatedQuestions: Question[] = ${JSON.stringify(exams.flatMap((exam) => exam.questions), null, 2)}\n\n` +
    `export const generatedPracticeExams: PracticeExam[] = ${JSON.stringify(
      exams.map(({ questions: _questions, ...exam }) => exam),
      null,
      2,
    )}\n`,
)

console.log(`Generated ${exams.length} Cloud Practitioner exams with ${totalQuestions} questions.`)
