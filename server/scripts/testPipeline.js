import 'dotenv/config';
import mongoose from 'mongoose';
import MasterResume from '../src/models/MasterResume.js';
import ResumeBullet from '../src/models/ResumeBullet.js';
import { extractJdKeywords } from '../src/services/extractJdKeywords.js';
import { normalizeSkills } from '../src/services/normalizeSkills.js';
import { gapAnalysis } from '../src/services/gapAnalysis.js';
import { roleFitGate } from '../src/services/roleFitGate.js';

// Real postings copied from job portals by the user, pasted 2026-08-27, for
// eyeballing extraction/gap-analysis/role-fit accuracy end-to-end.
const JD_SAMPLES = [
  {
    company: 'ConnexAI — Senior Software Engineer',
    text: `Senior Software Engineer, Manchester Area, United Kingdom (Hybrid). Full-time permanent.

Role Summary:
You will join a development team in the conversational AI sector, shaping digital presence by building SaaS applications and working on real-time systems processing billions of hours of calls annually. Key involvement includes building quality assessment features to enhance agent-customer interactions, streamlining innovative projects, and enhancing existing architecture using modern web tech with a balance of autonomy and collaboration. Clear avenues for career growth are available (Principal Developer or Team Lead).

Key Responsibilities & Tech Stack:
Hands-on development using the latest versions of Node.js, Express.js, TypeScript, and React.js. Developing new components, creating complex customer-facing UIs, and collaborating with Data Science teams on AI offerings. Technologies used include AWS, Linux (Systems Administration), Docker, PostgreSQL, WebSockets, APIs, and Git.

Requirements & Qualifications:
Passionate about staying updated on web technologies, with commercial experience writing complex Node.js/TypeScript code, solid Git and Docker usage, Linux Systems Administration understanding, and hands-on experience developing/consuming APIs.`,
  },
  {
    company: 'Murmuration — Full Stack Engineer (AI Native)',
    text: `Full Stack Engineer (AI Native), Manchester, England, United Kingdom (Remote or hybrid). Full-time permanent. £70,000-£85,000 GBP per year.

Role Summary:
Murmuration is a new technology company building the core platform for credit unions (software, payments, and data infrastructure). Reporting directly to the CTO, you will be one of the early engineers with direct say over product design, architecture, and engineering standards. The workflow is strictly AI-native, expecting fluency with AI coding tools alongside feature building for assistants, automation, and document processing.

Key Responsibilities & Tech Stack:
Design, build, and ship full-stack features across the front end (React/TypeScript) and back end (Node, Python, or Go). Design and consume REST/GraphQL APIs connecting to CBS, payments, and third-party services. End-to-end feature ownership: implementation, testing, deployment, and support. Set engineering standards, conduct code reviews, and write automated tests while working alongside product, design, platform, and payments teams.

Requirements & Qualifications:
Strong full-stack production background (front-end framework + back-end language), daily fluency using AI coding tools with a practical view of their limitations, solid API integration skills, and strong fundamentals (testing, CI/CD, version control, secure coding). Must be comfortable with early-stage high ownership. Standout qualifications include fintech/banking experience, track record of shipping production AI/LLM features, cloud-native work (AWS/Azure/GCP, containers, IaC), and team mentoring/standards-setting experience.`,
  },
  {
    company: 'Digital Skills Ltd — Full Stack Engineer',
    text: `Full Stack Engineer, contract, Manchester Area (Hybrid — 2 days per week on-site). 6-month rolling contract, Inside IR35, £600/day.

Role Summary:
High-profile digital product team delivering customer-facing search and engagement experiences at global scale within a cloud-native platform. Combines hands-on development across frontend/backend stacks with modern AI-assisted software engineering practices.

Key Responsibilities & Tech Stack:
Developing customer-facing web apps using React, TypeScript, and Micro Frontend (MFE) architectures alongside backend microservices using Java. Translating product/UX requirements into high-quality solutions, contributing to system design, RESTful API integrations, scalable distributed services, monitoring, performance tuning, and participating in Agile ceremonies.

Requirements & Qualifications:
Commercial full-stack engineering background with Java backend web services/APIs and React/TypeScript on the frontend. Solid experience with Micro Frontends (MFE), Backend-for-Frontend (BFF) patterns, AWS deployment, Git, automated testing, distributed systems, and cross-team stakeholder collaboration. Nice-to-haves include Agentic AI, AI developer tools, Kubernetes, Docker, CI/CD, observability (SLIs/SLOs), large-scale consumer applications, and A/B experimentation platforms.`,
  },
  {
    company: 'Found Talent — Senior Front End Developer',
    text: `Senior Front End Developer, Manchester Area, United Kingdom (Hybrid). Full-time permanent.

Role Summary:
Product-led Agile team where you take direct ownership of front-end development, component architectural choices, and the long-term evolution of a core product platform.

Key Responsibilities & Tech Stack:
Building scalable, reusable web interfaces and components using Angular and TypeScript. Integrating front-end elements with backend APIs and services while optimizing performance, accessibility, responsiveness, and usability. Participating in code reviews, Agile sprints, and shaping front-end code standards.

Requirements & Qualifications:
Mandatory poster requirements specify 5+ years of experience with Angular, 5+ years with TypeScript, and 5+ years working in Agile environments, alongside authorization to work in the UK. Requires deep understanding of modern JavaScript, HTML, CSS, API integrations, and user experience optimization.`,
  },
  {
    company: 'Bauer Media Outdoor UK — Senior Full Stack Engineer',
    text: `Senior Full Stack Engineer, Manchester Area, United Kingdom (Hybrid — 2 days on-site per week). Permanent full-time.

Role Summary:
Joining Bauer Media Audio (BMA) within a brand-new in-house development hub in Manchester. You will lay the technical foundation for this new engineering department, leading hands-on development of early infrastructure, architectural components, and prototypes while mentoring mid/junior engineers.

Key Responsibilities & Tech Stack:
Full-stack development across modern stacks: Node/TypeScript + React frontend, Java backend, AWS, Kubernetes, and Kafka infrastructure. Take ownership of functional areas, lead small feature-driven sub-teams, and embrace "you build it, you run it" DevOps principles (CI/CD, observability, OWASP security standards). Conduct testing strategies (unit, integration, E2E), assist in hiring/onboarding, and participate in 24/7 in-hours/out-of-hours incident management rotas.

Requirements & Qualifications:
Strong commercial full-stack engineering depth across both client/server layers. Depth in microservices, event-driven architecture, cloud services (AWS), containerization (Docker/Kubernetes), CI/CD, and IaC. Proven leadership/mentoring skills, OWASP security awareness, strong debugging skills under pressure, and adaptability. Desired traits include media/streaming platform experience, incident management background, technical documentation skills, and familiarity with AI-assisted engineering tools (Copilot, Claude).`,
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('connected');

  const resume = await MasterResume.findOne({ status: 'active' }).sort({ uploadedAt: -1 });
  if (!resume) {
    throw new Error('No active master resume found — upload one via the app first.');
  }

  const bullets = await ResumeBullet.find({ masterResumeId: resume._id });
  if (bullets.length === 0) {
    throw new Error('Active resume has no bullets — check the upload flow.');
  }

  console.log('Loaded resume:', resume.label, '| bullets:', bullets.length);

  const resumeRawSkills = bullets.flatMap((bullet) => bullet.skills);
  const resumeCanonical = normalizeSkills(resumeRawSkills);
  console.log('Resume canonical skills:', resumeCanonical);

  for (const { company, text } of JD_SAMPLES) {
    console.log('\n=====', company, '=====');

    const jdKeywords = await extractJdKeywords(text);
    console.log('JD keywords:', jdKeywords);

    const jdCanonical = normalizeSkills([...jdKeywords.skills, ...jdKeywords.tools]);
    console.log('JD canonical skills:', jdCanonical);

    const gaps = gapAnalysis(jdCanonical, resumeCanonical);
    console.log('Keyword gaps:', gaps);

    const fit = await roleFitGate({
      jdText: text,
      jdCanonicalSkills: jdCanonical,
      resumeCanonicalSkills: resumeCanonical,
      resumeSummary: resume.summary,
      resumeTitle: resume.personalInfo?.title,
    });
    console.log('Role fit:', fit);
  }

  await mongoose.disconnect();
  console.log('\ndone');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
