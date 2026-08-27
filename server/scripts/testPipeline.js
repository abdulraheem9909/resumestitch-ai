import 'dotenv/config';
import mongoose from 'mongoose';
import MasterResume from '../src/models/MasterResume.js';
import ResumeBullet from '../src/models/ResumeBullet.js';
import { extractJdKeywords } from '../src/services/extractJdKeywords.js';
import { normalizeSkills } from '../src/services/normalizeSkills.js';
import { gapAnalysis } from '../src/services/gapAnalysis.js';

// Real, pasted-as-is postings from companies in the target list (about-this-project.md),
// pulled 2026-08-27, for eyeballing extraction/gap-analysis accuracy end-to-end.
const JD_SAMPLES = [
  {
    company: 'Monzo — Senior Staff Backend Engineer',
    text: `Senior Staff Engineer: L70 on our Engineering Progression Framework

About our Engineering Teams:
We have around 650 engineers out of roughly 5,500 people in total - and we have big ambitions. There are many interesting challenges ahead, and we're happy for people to move between teams or to specialise, whatever you prefer.

Senior Staff Engineer Responsibilities:
A Senior Staff Engineer at Monzo is a hands on engineering leadership (IC) position. As a Senior Staff Engineer you'll:
- Partner with Engineering Directors to shape the technical and product direction of a collective, providing leadership across multiple squads (30-70+ engineers) and ensuring alignment with company-wide priorities.
- Be hands on in both coding and architecture, leading from the front.
- Partner closely with Product and Design leadership to define strategy, shape roadmaps, and make high-quality trade-offs.
- Mobilise teams across your collective around high-impact problems.
- Lead and influence architectural direction for the most complex systems, ensuring cohesive, scalable designs across multiple teams.
- Set and uphold a high bar for technical excellence, driving improvements in quality, reliability and scalability.
- Proactively mentor, sponsor and develop senior engineers and future leaders.

What you'll be using/ What you'll be working on:
We rely heavily on the following tools and technologies:
- Go to write our application code
- Cassandra for most persistent data storage
- Kafka for our asynchronous message queue
- Kubernetes and Docker to schedule and run our services
- AWS for most of our production infrastructure and GCP for most of our data infrastructure
- React for internal Web dashboards
- Feast for storing our features along a variety of tools to train and deploy models

We'd love to hear from you if:
- You have a track record of leading complex, high-impact systems and driving technical direction across multiple teams
- You combine strong technical judgment with product and business awareness, making pragmatic trade-offs
- You've worked on scalable backend, distributed or data-intensive systems
- You're comfortable operating in ambiguous problem spaces
- You influence and align senior stakeholders across engineering, product and beyond
- You enjoy mentoring and raising the bar for other engineers`,
  },
  {
    company: 'Checkout.com — Senior Software Engineer I',
    text: `Job Description
Global payments are complex and ever-evolving. At Checkout our software engineers develop the next-generation payments technologies that enable our Merchants to boost their acceptance rates, cut processing costs, fight fraud, and create cutting edge technology that enables extraordinary customer experiences.

We're looking for Senior Software engineers who bring fresh ideas, have a curious nature and are passionate about working in an Engineering environment which focuses on building products to achieve the company's strategic goals. As a Senior Software engineer, you will lead and drive specific projects critical to Checkout's needs, working across the full-stack. You will design, develop, test, deploy, maintain, and enhance software solutions.

What are we looking for:
- Bachelor's or Master's degree in Computer Science, Engineering, or related field
- Proficiency in C# .NET, Java, or Go, with a strong understanding of software development principles in either a backend or full stack environment.
- Great communication skills and ability to interact effectively with a wide range of stakeholders
- Experience working in agile environments and delivering high-quality code within tight deadlines
- Excellent problem-solving skills and the ability to work independently as well as part of a team
- Someone who is AI proficient or AI curious, hungry to embrace what the latest technology has to offer
- Payments or financial knowledge is a plus, but not a necessity

How you'll make an impact:
- Be part of, and collaborate with, cross-functional teams including product management, across a large engineering community.
- Define and design loosely coupled, scalable systems in a wider microservices using industry best practices.
- Stay up-to-date, use, and spread knowledge of the latest technologies used by Checkout.
- Write clean, maintainable, extendable and testable code on some of Checkout's most impactful systems.
- Build, own and operate your systems to the highest levels of resilience and service.
- Mentor junior team members and assist in their technical development`,
  },
  {
    company: 'Faculty AI — Software Engineer (Machine Learning)',
    text: `What You'll Be Doing
You will design, build, and deploy production-grade software, infrastructure, and MLOps systems that leverage machine learning. As a Machine Learning Engineer you'll be essential to helping us achieve that goal by:
- Building software and infrastructure that leverages Machine Learning
- Creating reusable, scalable tools to enable better delivery of ML systems
- Working and mentoring data scientists and engineers to develop best practices and new technologies
- Implementing and developing Faculty's view on what it means to operationalise ML software
- Leading on the scope and design of projects
- Offering leadership and management to more junior engineers on the team
- Providing technical expertise to our customers
- Technical Delivery: work with cross-functional teams of engineers (Frontend & Cloud), data scientists, product designers and managers to deliver ML systems
- Translate user research outcomes into full system architecture that leverages Machine Learning

Who We're Looking For
To succeed in this role, you'll need the following - these are illustrative requirements and we don't expect all applicants to have experience in everything (70% is a rough guide):
- Understanding of, and interest in, the full machine learning lifecycle, including deploying trained machine learning models developed using common frameworks such as Scikit-learn, TensorFlow, or PyTorch
- Understanding of the core concepts of probability and statistics and familiarity with common supervised and unsupervised learning techniques
- Technical experience of cloud architecture, security, deployment, and open-source tools
- Demonstrable experience with containers and specifically Docker and Kubernetes
- Comfortable in a high-growth startup environment
- Outstanding verbal and written communication
- Experience working directly with clients and end users to conduct: Requirements Gathering, Technical Planning and Scoping
- Technical experience of cloud architecture, security, networking, deployment, and open-source tools ideally with one of the 3 major cloud providers (AWS, GCP or Azure)
- Experience with software engineering best practices and developing applications in Python`,
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
  }

  await mongoose.disconnect();
  console.log('\ndone');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
