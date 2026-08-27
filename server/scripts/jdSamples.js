// Real postings, round 2 — fetched directly from company career pages/APIs
// (Greenhouse-hosted, mostly) for companies in the target list from
// about-this-project.md plus a few adjacent UK tech/AI companies, pulled
// 2026-08-27. Shared between testPipeline.js (raw functions) and
// testJobAgentGraph.js (assembled graph), so both run against identical data.
export const JD_SAMPLES = [
  {
    company: 'Auto Trader — Senior Software Engineer, Backend',
    text: `Senior Software Engineer, Backend, Manchester. Salary £50,000-£70,000, plus 10% annual share award.

About the role:
We're looking for Senior Software Engineers to help us build a technology platform for more than just the needs of Autotrader.co.uk. Utilising our public-facing web services and additional external data sources means that we'll be able to power businesses across the automotive industry.

Spring Boot, Apache Solr, Cloud SQL and Apache Kafka power our platform and process millions of events per day. As a team, our software developers are responsible for ensuring service availability and responsiveness continue to improve. They work on systems that handle thousands of requests per second, with sub-100 millisecond response times, servicing requests from over 50 client applications.

What We're Looking For:
- In depth understanding of Java and the JVM
- Knowledge of server-side frameworks such as Spring
- Web application design and RESTful API know-how
- A structured approach to programming and testing, such as TDD
- Passionate about mentoring and coaching and sharing technical expertise

Although not a requirement, helpful experience includes:
- Google Cloud
- SQL/Relational databases
- Document/Map based storage (eg: MongoDB)
- Working with Kafka messaging/streaming`,
  },
  {
    company: 'Peak AI — Engineering (general roles overview)',
    text: `Engineering at Peak — building an AI platform that optimizes product inventory and pricing.

Our teams leverage cutting-edge tech to ensure our platform is robust, scalable, delivers an exceptional user experience and faster time to value. Peak believes that every organization needs its own AI, and our product has been built from the ground up to achieve that. This innovative platform empowers users to build and deploy intricate AI solutions in weeks, not years.

The Peak platform is capable of handling terabytes of data, managing inbound and outbound data integrations and developing comprehensive AI/ML products that address specific business needs. Our engineering team also contribute to the integrations and work we do with our partners including AWS, Snowflake, SAP and UiPath. We adhere to industry-leading software development practices, utilizing microservices and micro-front end architectures.

Our major tech stack includes:
- Processing, orchestration and back end: Kubernetes and Lambda on AWS
- Programming tools: Node.js and React
- Monitoring and observability: Prometheus and the ELK stack
- CI/CD tools: Terraform, Helm, GitHub Actions and AWS CloudFormation
- Data tech: Redshift, Snowflake, PostgreSQL and DynamoDB

AI Engineering team is responsible for building and delivering our Inventory AI and Pricing AI products, and Peak's agentic assistant, Co:Driver. This requires prioritizing innovation, scalability, accuracy, user experience, collaboration and agility. Our tech stack for this team includes Dash, FastAPI, DBT, and we heavily use Python for our in-house built AI models.`,
  },
  {
    company: 'Revolut — Mid/Senior Backend Engineer',
    text: `Mid/Senior Backend Engineer, Technology team.

About the role:
Our Technology team builds the systems and experiences that keep Revolut moving. From the infrastructure behind our innovative app to the features used by millions of people around the world, they bring sharp thinking, speed, and a focus on meaningful impact to everything they do.

We're looking for a Mid/Senior Backend Engineer to join a team that keeps frameworks lean and focuses on what matters: clean, maintainable code, shipped fast with TDD, DDD, and continuous integration and delivery.

Our stack includes Java 17/21, GCP, Kubernetes, Grafana, Prometheus, NewRelic, PostgreSQL, Redis, Spock, jOOQ, and Flyway.

What you'll be doing:
- Building mobile APIs
- Developing microservices to evolve our architecture
- Perfecting systems that our business depends on, like risk management, fraud detection, and payment processing
- Focusing on greenfield development and improvement of existing systems

What you'll need:
- Fluency with Java
- 4+ years of experience in backend development
- A bachelor's degree in computer science, maths, physics, or similar field
- To be a quick learner with an ambitious attitude and results-driven personality
- The ability to work well as part of a team in a fast-paced environment

Nice to have:
- Proficiency with Kotlin or Scala
- A background in finance
- Experience in a startup or scale-up
- Experience in a product-focused environment`,
  },
  {
    company: 'GoCardless — Software Development Engineer III, Payment Intelligence',
    text: `Software Development Engineer III, Payment Intelligence.

About us:
GoCardless is a global bank payment company. Over 100,000 businesses, from start-ups to household names, use GoCardless to collect, manage and send bank payments through Direct Debit, real-time payments and open banking. Our end-to-end payment platform also features AI-powered solutions to improve payment success and reduce fraud.

Engineering at GoCardless:
Our technologies: We endeavour to build simple, reliable systems and we believe in using the best technologies for each task. Technologies we use across GoCardless include: Ruby on Rails, Golang, Python, JavaScript, TypeScript, React, Postgres, BigQuery, Kubernetes, Elasticsearch, Prometheus, Google Cloud (GCP).

The Role:
Our mission as the Payment Intelligence team is to augment our bank payments product with intelligent data products that differentiate our offering and increase our win rates. Our focus areas are our existing products, Success+ and Protect+ — creating market-leading payment recovery rates and fraud prevention products.

As an engineer, you will be actively working on projects that help grow the adoption of these products while improving the experience of using them, aided and supported by a cross functional team of engineers and data scientists.`,
  },
  {
    company: 'Wayve — Full-Stack Software Engineer, Model Development Platform',
    text: `Full-Stack Software Engineer, Model Development Platform, London.

About us:
Wayve is the leading developer of Embodied AI technology. Our advanced AI software and foundation models enable vehicles to perceive, understand, and navigate any complex environment, enhancing the usability and safety of automated driving systems.

The Role:
As a Full-Stack Software Engineer within Wayve's Model Development Platform, you will design, build, and operate the applications and services that support the development and testing of our autonomous driving models. These systems help researchers and engineers manage workflows spanning data, model training, experiment scheduling, evaluation, and on-road testing.

You will work across the full technology stack, creating intuitive web applications and the scalable backend services, APIs, and data models that power them.

Essential:
- Full-stack engineering — Strong experience designing, building, and operating production web applications across frontend and backend systems. Experience with modern technologies such as React, TypeScript, Python, Flask, or FastAPI — or comparable frameworks and languages.
- Production system design — A strong understanding of system design, API design, data modeling, asynchronous workflows, automated testing, and distributed-system fundamentals.
- End-to-end ownership — A track record of taking significant features or services from problem definition and technical design through implementation, deployment, and production operation.
- Technical leadership and mentorship — Experience leading technical discussions and supporting other engineers through design reviews, code reviews, and pairing.

Desirable:
- Developer or ML Platforms — Experience building internal platforms, developer tools, workflow systems, or applications used by machine-learning researchers and engineers.
- ML Operations and Experimentation — Familiarity with model training, evaluation, experiment tracking, artifact management, or related model-development workflows.
- Data and Workflow Systems — Experience with data pipelines, distributed job orchestration, event-driven architectures, or large-scale compute platforms.
- Platform Observability — Experience defining service-level indicators and objectives and using metrics, logs, traces, and alerting to improve production reliability.`,
  },
];
