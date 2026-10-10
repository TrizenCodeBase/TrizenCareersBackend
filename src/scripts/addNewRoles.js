import dotenv from 'dotenv';
dotenv.config();

import { connectMongo } from '../config/mongodb.js';
import Job from '../models/Job.js';
import { registerDynamicJob } from '../config/jobRegistry.js';

const newJobs = [
  {
    id: 'TV-DAT-LEMD-2026-012',
    title: 'Lead / Engineering Manager — Data Analytics',
    slug: 'lead-engineering-manager-data-analytics',
    category: 'Data Analytics / Engineering Leadership',
    location: 'Bengaluru, India',
    type: 'Full-Time',
    duration: 'Full-Time',
    startDate: 'Immediate',
    applicationDeadline: 'Rolling basis',
    postedDate: '2026-10-10',
    status: 'published',
    shortDescription: 'Lead the analytics engineering and business intelligence teams, own the analytics engineering roadmap, and drive self-service analytics, data governance, and reliable business reporting.',
    description: 'Lead the analytics engineering and business intelligence teams, own the analytics engineering roadmap, and drive self-service analytics, data governance, and reliable business reporting.',
    responsibilities: [
      'Lead Analytics Engineers and BI Developers.',
      'Own DBT transformation layers, semantic models, and Gold-layer data products in Redshift.',
      'Drive self-service analytics and data democratisation.',
      'Establish BI standards and govern reporting infrastructure.',
      'Partner with the Data Platform team on data availability and quality.',
      'Work with UK business stakeholders to understand reporting requirements.',
      'Establish data governance and data quality standards.',
      'Hire, mentor, and develop analytics engineering talent in Bengaluru.'
    ],
    requirements: [
      '15+ years in analytics engineering, data analytics, or BI leadership.',
      'At least 5 years of management experience.',
      'Deep expertise in Amazon Redshift and Gold-layer architecture.',
      'Strong DBT experience with transformation layers and semantic models.',
      'Experience leading BI platforms and self-service analytics initiatives.',
      'Familiarity with Tableau, Power BI, Looker, or equivalent tools.',
      'Strong understanding of data governance.',
      'Payments or fintech experience preferred.',
      'Proven ability to build and develop engineering teams.'
    ],
    preferredExperience: [
      'Payments or fintech experience preferred.',
      'Cross-border team leadership and UK stakeholder collaboration.'
    ],
    tags: [
      'Analytics Engineering',
      'DBT',
      'Amazon Redshift',
      'SQL',
      'Semantic Modelling',
      'BI Platforms',
      'Tableau',
      'Power BI',
      'Looker',
      'Data Governance',
      'Team Leadership'
    ],
    benefits: [
      'Opportunity to lead analytics engineering and BI initiatives.',
      'Ownership of analytics architecture and roadmap decisions.',
      'Collaboration with international business stakeholders.',
      'Opportunity to develop high-performing technical teams.'
    ],
    selectionProcess: [
      'Resume & Portfolio Screening',
      'Technical Architecture & Leadership Interview',
      'Stakeholder & Cultural Alignment Round'
    ]
  },
  {
    id: 'TV-DAT-SEDA-2026-013',
    title: 'Staff Engineer — Data Analytics',
    slug: 'staff-engineer-data-analytics',
    category: 'Data Analytics / Engineering',
    location: 'Bengaluru, India',
    type: 'Full-Time',
    duration: 'Full-Time',
    startDate: 'Immediate',
    applicationDeadline: 'Rolling basis',
    postedDate: '2026-10-10',
    status: 'published',
    shortDescription: 'Design and build scalable analytics models and data products using DBT and Amazon Redshift, while establishing engineering standards and mentoring analytics engineering teams.',
    description: 'Design and build scalable analytics models and data products using DBT and Amazon Redshift, while establishing engineering standards and mentoring analytics engineering teams.',
    responsibilities: [
      'Design DBT transformation models and semantic layers on Redshift Gold layer.',
      'Define analytics engineering standards, naming conventions, and documentation practices.',
      'Build and maintain pipelines from Bronze ingestion through Gold data products.',
      'Collaborate with BI Developers to meet reporting requirements.',
      'Implement data quality checks in analytics pipelines.',
      'Support data lineage, documentation, and metadata management.',
      'Address complex analytical requirements from UK stakeholders.',
      'Mentor Lead and Senior Analytics Engineers.'
    ],
    requirements: [
      '10+ years in analytics engineering, data engineering, or BI engineering.',
      'Expert-level DBT skills covering modelling, testing, documentation, and deployment.',
      'Deep experience with Redshift and Gold-layer design and optimisation.',
      'Strong SQL and data modelling skills, including dimensional modelling and slowly changing dimensions.',
      'Experience with Tableau, Power BI, Looker, or equivalent BI tools.',
      'Familiarity with data quality frameworks.',
      'Understanding of PCI DSS requirements for analytics data.',
      'Ability to establish technical standards and mentor engineers.'
    ],
    preferredExperience: [
      'Experience handling PCI DSS regulated transaction data.',
      'Experience with complex semantic layer implementations.'
    ],
    tags: [
      'DBT',
      'Amazon Redshift',
      'SQL',
      'Data Modelling',
      'Dimensional Modelling',
      'Semantic Layers',
      'Data Pipelines',
      'BI Tools',
      'Data Quality',
      'Data Governance',
      'PCI DSS'
    ],
    benefits: [
      'Opportunity to design large-scale analytics data products.',
      'Ownership of engineering standards and modelling practices.',
      'Exposure to enterprise data platforms and BI systems.',
      'Opportunity to mentor engineers and influence technical architecture.'
    ],
    selectionProcess: [
      'Resume Review',
      'Data Modelling & DBT Deep-Dive Round',
      'System Design & Architecture Discussion'
    ]
  },
  {
    id: 'TV-DBA-LDBA-2026-014',
    title: 'Lead Database Administrator — SQL Server',
    slug: 'lead-database-administrator-sql-server',
    category: 'Database Administration / IT',
    location: 'Bengaluru, India',
    type: 'Full-Time',
    duration: 'Full-Time',
    startDate: 'Immediate',
    applicationDeadline: 'Rolling basis',
    postedDate: '2026-10-10',
    status: 'published',
    shortDescription: 'Own production SQL Server environments, ensuring database performance, availability, security, compliance, and reliable data integration across enterprise systems.',
    description: 'Own production SQL Server environments, including performance, availability, security, and compliance. Define and implement data retention and deletion policies.',
    responsibilities: [
      'Manage production SQL Server environments, including performance, availability, security, and compliance.',
      'Define and implement data retention and deletion policies.',
      'Lead SQL Server Change Data Capture (CDC) configuration for Redshift ingestion.',
      'Manage data growth through archiving, partitioning, and capacity planning.',
      'Establish backup and recovery standards across four environments.',
      'Collaborate with the Data Platform team on platform consolidation.',
      'Mentor and manage individual-contributor DBAs.'
    ],
    requirements: [
      '12+ years of SQL Server DBA experience, including multiple production environments.',
      'Experience managing large-scale SQL Server estates and data volumes.',
      'Expertise in data retention, archiving, and deletion policies.',
      'Strong SQL Server CDC experience for downstream ingestion pipelines.',
      'AWS experience with EC2 and DynamoDB.',
      'Experience working with legacy SQL Server environments and technical debt.',
      'Strong people management and mentoring skills.'
    ],
    preferredExperience: [
      'Experience migrating SQL Server workloads or consolidating platforms.',
      'Production experience with high-throughput CDC feeding cloud data warehouses.'
    ],
    tags: [
      'Microsoft SQL Server',
      'SQL',
      'Database Administration',
      'CDC',
      'AWS EC2',
      'DynamoDB',
      'Backup and Recovery',
      'Data Archiving',
      'Performance Tuning',
      'Database Security'
    ],
    benefits: [
      'Ownership of enterprise database reliability and performance.',
      'Exposure to large-scale production database environments.',
      'Opportunity to lead database improvement and consolidation initiatives.',
      'Opportunity to mentor database professionals.'
    ],
    selectionProcess: [
      'Profile Screening',
      'Database Administration & High Availability Interview',
      'Leadership & Systems Architecture Round'
    ]
  },
  {
    id: 'TV-DBA-DBAS-2026-015',
    title: 'Database Administrator — SQL Server (Senior)',
    slug: 'database-administrator-sql-server-senior',
    category: 'Database Administration / IT',
    location: 'Bengaluru, India',
    type: 'Full-Time',
    duration: 'Full-Time',
    startDate: 'Immediate',
    applicationDeadline: 'Rolling basis',
    postedDate: '2026-10-10',
    status: 'published',
    shortDescription: 'Administer and optimise production SQL Server environments, maintain reliable data ingestion pipelines, and support database security, retention, backup, and recovery operations.',
    description: 'Administer and optimise production SQL Server environments, maintain reliable data ingestion pipelines, and support database security, retention, backup, and recovery operations.',
    responsibilities: [
      'Monitor SQL Server performance and manage indexes and query tuning.',
      'Support implementation of data deletion and retention policies.',
      'Monitor and maintain CDC pipelines feeding Redshift.',
      'Perform backup, recovery, and high-availability operations.',
      'Maintain database security standards across production environments.'
    ],
    requirements: [
      '10+ years of SQL Server DBA experience in multiple production environments.',
      'Knowledge of SQL Server CDC for downstream data ingestion.',
      'AWS experience with EC2 and DynamoDB.',
      'Experience implementing data retention and deletion policies.',
      'Strong SQL performance tuning and troubleshooting skills.'
    ],
    tags: [
      'SQL Server',
      'SQL',
      'CDC',
      'AWS EC2',
      'DynamoDB',
      'Query Optimisation',
      'Index Management',
      'Backup and Recovery',
      'High Availability',
      'Database Security'
    ],
    benefits: [
      'Opportunity to manage enterprise database operations.',
      'Exposure to AWS services and data ingestion systems.',
      'Opportunity to improve database performance and reliability.',
      'Experience supporting enterprise data platform initiatives.'
    ],
    selectionProcess: [
      'Technical Evaluation',
      'Live Troubleshooting & Query Tuning Round',
      'Managerial Discussion'
    ]
  },
  {
    id: 'TV-DBA-DBAJ-2026-016',
    title: 'Database Administrator — SQL Server (Junior)',
    slug: 'database-administrator-sql-server-junior',
    category: 'Database Administration / IT',
    location: 'Bengaluru, India',
    type: 'Full-Time',
    duration: 'Full-Time',
    startDate: 'Immediate',
    applicationDeadline: 'Rolling basis',
    postedDate: '2026-10-10',
    status: 'published',
    shortDescription: 'Support the administration and maintenance of production SQL Server environments, focusing on performance monitoring, data retention, CDC pipelines, backups, recovery, and security.',
    description: 'Support the administration and maintenance of production SQL Server environments, focusing on performance monitoring, data retention, CDC pipelines, backups, recovery, and security. Note: Requires 8+ years of experience in production environments.',
    responsibilities: [
      'Administer SQL Server environments and monitor database performance.',
      'Manage indexes and assist with query tuning.',
      'Support retention and deletion policies under the Lead DBA direction.',
      'Assist in monitoring CDC pipelines feeding Redshift.',
      'Perform backup, recovery, and high-availability operations.',
      'Follow production database security standards.'
    ],
    requirements: [
      '8+ years of SQL Server DBA experience in production environments.',
      'Working knowledge of SQL Server CDC and change data capture concepts.',
      'AWS exposure to EC2 and DynamoDB.',
      'Awareness of data retention and deletion requirements.',
      'Strong SQL administration skills.'
    ],
    tags: [
      'SQL Server',
      'SQL',
      'CDC',
      'AWS EC2',
      'DynamoDB',
      'Database Monitoring',
      'Index Management',
      'Backup and Recovery',
      'Query Tuning',
      'Database Security'
    ],
    benefits: [
      'Opportunity to work with production database environments.',
      'Exposure to enterprise database operations and data pipelines.',
      'Opportunity to strengthen database administration and troubleshooting skills.',
      'Experience supporting database reliability and security.'
    ],
    selectionProcess: [
      'Resume Screening',
      'Technical DBA Assessment',
      'Final Discussion'
    ]
  },
  {
    id: 'TV-PRD-DTPM-2026-017',
    title: 'Data and AI Technical Product Manager',
    slug: 'data-and-ai-technical-product-manager',
    category: 'Product Management / Data & AI',
    location: 'Bengaluru, India',
    type: 'Full-Time',
    duration: 'Full-Time',
    startDate: 'Immediate',
    applicationDeadline: 'Rolling basis',
    postedDate: '2026-10-10',
    status: 'published',
    shortDescription: 'Own the technical product vision for data and AI capabilities, connecting engineering execution with business strategy in a regulated payments environment.',
    description: 'Own the technical product vision for data and AI capabilities, connecting engineering execution with business strategy. Drive platform decisions, data governance, and delivery across engineering teams in a regulated payments environment.',
    responsibilities: [
      'Define the technical product roadmap for data platforms, AI/ML, and analytics.',
      'Translate strategic data objectives into engineering deliverables and measurable outcomes.',
      'Coordinate between UK engineering leadership and Bengaluru delivery teams.',
      'Drive platform decisions across Redshift, AWS Bedrock, and FeatureSpace.',
      'Support platform consolidation, including Snowflake decommissioning and Confluent-to-RedPanda migration.',
      'Own data governance, data quality, and PCI DSS compliance from a product perspective.',
      'Prioritise work across data engineering, ML, analytics, and BI.',
      'Evaluate build-versus-buy decisions for AI/ML tooling and agentic workflows.',
      'Represent the programme in steering committees and executive reporting.'
    ],
    requirements: [
      '20+ years in technical product management, including at least 8 years focused on data and AI platforms.',
      'Experience owning data platform products in regulated environments; payments, fintech, or banking preferred.',
      'Hands-on background in data engineering or ML engineering.',
      'Experience with AWS, Redshift, SQL Server, and Kafka/MSK or equivalent streaming platforms.',
      'Strong understanding of PCI DSS, data governance, and compliance-led product design.',
      'Experience managing distributed engineering teams.',
      'Excellent executive communication and stakeholder influence.'
    ],
    idealCandidate: 'Seasoned technical leader who bridges deep data architecture with C-level product strategy, thrives in regulated fintech, and commands technical authority across AI and data platforms.',
    tags: [
      'Technical Product Management',
      'Data Platforms',
      'AI/ML',
      'AWS',
      'Amazon Redshift',
      'SQL Server',
      'Kafka',
      'MSK',
      'AWS Bedrock',
      'FeatureSpace',
      'Data Governance',
      'PCI DSS',
      'Product Roadmaps'
    ],
    benefits: [
      'Ownership of technical product strategy for data and AI.',
      'Opportunity to influence enterprise architecture and platform decisions.',
      'Collaboration with engineering leadership and executive stakeholders.',
      'Exposure to large-scale data and AI transformation programmes.'
    ],
    selectionProcess: [
      'Initial Screening',
      'Technical Product Strategy Interview',
      'Executive Leadership & Stakeholder Presentation'
    ]
  },
  {
    id: 'TV-PRD-DAPM-2026-018',
    title: 'Data and AI Product Manager',
    slug: 'data-and-ai-product-manager',
    category: 'Product Management / Data & AI',
    location: 'Bengaluru, India',
    type: 'Full-Time',
    duration: 'Full-Time',
    startDate: 'Immediate',
    applicationDeadline: 'Rolling basis',
    postedDate: '2026-10-10',
    status: 'published',
    shortDescription: 'Own the business-facing product strategy for data and AI capabilities, translating customer and internal stakeholder needs into a prioritised roadmap covering analytics, reporting, and AI-assisted workflows.',
    description: 'Own the business-facing product strategy for data and AI capabilities, translating customer and internal stakeholder needs into a prioritised roadmap covering analytics, reporting, and AI-assisted workflows.',
    responsibilities: [
      'Own the product vision and backlog for data and AI products.',
      'Work with UK-based business stakeholders to capture and refine requirements.',
      'Define user stories, acceptance criteria, and release plans.',
      'Drive adoption of Claude Code, Claude Enterprise, and AI-assisted tools.',
      'Own the roadmap for BI, self-service analytics, and data democratisation.',
      'Monitor product performance and improve features using data and stakeholder feedback.',
      'Collaborate with data governance teams to meet PCI DSS and regulatory requirements.'
    ],
    requirements: [
      '20+ years in product management, with significant experience in data, analytics, or AI products.',
      'Understanding of data lakes, lakehouses, data warehousing, BI, and ML pipelines.',
      'Experience in payments, fintech, financial services, or other regulated industries preferred.',
      'Familiarity with AWS data services, Redshift, and modern analytics tools.',
      'Strong stakeholder management skills.',
      'Excellent written and verbal communication across technical and non-technical teams.'
    ],
    tags: [
      'Product Management',
      'Data Analytics',
      'AI Products',
      'Product Roadmaps',
      'User Stories',
      'BI',
      'Self-Service Analytics',
      'AWS',
      'Redshift',
      'Claude Code',
      'Claude Enterprise',
      'Data Governance',
      'Stakeholder Management'
    ],
    benefits: [
      'Opportunity to shape data and AI product strategy.',
      'Exposure to analytics, reporting, and AI-assisted workflows.',
      'Collaboration with international business and engineering teams.',
      'Opportunity to drive product adoption and business impact.'
    ],
    selectionProcess: [
      'Executive Profile Review',
      'Product Vision & Business Stakeholder Interview',
      'Final Alignment Discussion'
    ]
  },
  {
    id: 'TV-STR-DSTL-2026-019',
    title: 'Data Strategy Lead',
    slug: 'data-strategy-lead',
    category: 'Data Strategy / Leadership',
    location: 'Bengaluru, India',
    type: 'Full-Time',
    duration: 'Full-Time',
    startDate: 'Immediate',
    applicationDeadline: 'Rolling basis',
    postedDate: '2026-10-10',
    status: 'published',
    shortDescription: 'Define and drive enterprise data strategy, governance, and platform transformation toward a governed, Redshift-centred analytical platform.',
    description: 'Define and drive enterprise data strategy, governance, and platform transformation. Guide the organisation transition toward a governed, Redshift-centred analytical platform while establishing standards for data quality, architecture, and monetisation.',
    responsibilities: [
      'Define a multi-year data strategy aligned with business growth, regulatory requirements, and AI/ML goals.',
      'Lead the transition from a legacy SQL Server-heavy environment to a governed Redshift-centred platform.',
      'Guide platform consolidation, including Snowflake decommissioning and Confluent-to-RedPanda migration.',
      'Establish data governance, quality, and metadata frameworks.',
      'Work with data and engineering leadership to integrate data strategy into product roadmaps.',
      'Define standards for data ingestion, canonical IDs, and Bronze/Silver/Gold architecture.',
      'Identify opportunities to monetise proprietary transaction data.',
      'Represent data strategy in regulatory and compliance discussions, including PCI DSS and FCA requirements.'
    ],
    requirements: [
      '20+ years in data leadership, such as Chief Data Officer, VP Data, or equivalent roles.',
      'Experience developing data strategy in regulated financial services environments.',
      'Deep understanding of medallion architecture, data mesh, and lakehouse concepts.',
      'Experience with SQL Server, Redshift, and event-streaming platforms such as Kafka, Confluent, or RedPanda.',
      'Proven ability to establish data governance and quality frameworks from the ground up.',
      'Experience with data monetisation in transaction-rich environments.',
      'Strong executive communication and C-suite stakeholder influence.',
      'Experience leading distributed teams through platform transformations.'
    ],
    idealCandidate: 'Visionary enterprise data strategist with executive presence, deep knowledge of medallion architecture and regulatory compliance in fintech, and a track record of modernising complex legacy estates.',
    tags: [
      'Data Strategy',
      'Data Governance',
      'Data Architecture',
      'Amazon Redshift',
      'SQL Server',
      'Kafka',
      'Confluent',
      'RedPanda',
      'Data Mesh',
      'Lakehouse',
      'Bronze/Silver/Gold Architecture',
      'PCI DSS',
      'FCA Compliance',
      'Data Monetisation'
    ],
    benefits: [
      'Opportunity to define enterprise-wide data strategy.',
      'Ownership of governance and platform transformation initiatives.',
      'Exposure to modern data architectures and financial services.',
      'Opportunity to influence strategic business and technology decisions.'
    ],
    selectionProcess: [
      'C-Suite Screening',
      'Enterprise Architecture & Strategy Round',
      'Final Board & Executive Panel'
    ]
  },
  {
    id: 'TV-AIML-EMDS-2026-020',
    title: 'Lead / Engineering Manager — Data Science and ML',
    slug: 'lead-engineering-manager-data-science-and-ml',
    category: 'Data Science / Machine Learning',
    location: 'Bengaluru, India',
    type: 'Full-Time',
    duration: 'Full-Time',
    startDate: 'Immediate',
    applicationDeadline: 'Rolling basis',
    postedDate: '2026-10-10',
    status: 'published',
    shortDescription: 'Lead Data Science and ML teams for fraud detection, 3DS analytics, and AI initiatives in a payments technology environment.',
    description: 'Lead the Data Science and Machine Learning teams responsible for fraud detection, 3DS analytics, and new data products. Drive the development and productionisation of ML models, establish MLOps practices, and guide AI initiatives in a payments technology environment.',
    responsibilities: [
      'Lead Data Scientists and ML/AI Engineers across different seniority levels.',
      'Own the ML engineering roadmap for fraud detection, 3DS, and new projects.',
      'Drive productionisation of ML models and scalable, monitored ML pipelines.',
      'Oversee FeatureSpace integration for fraud detection.',
      'Define MLOps standards for model versioning, monitoring, retraining, and drift detection.',
      'Collaborate with AWS Bedrock and Claude-based teams on GenAI use cases.',
      'Work with the Data Platform team to ensure ML-ready data from Bronze, Silver, and Gold layers.',
      'Capture knowledge from departing legacy team members.',
      'Recruit, develop, and retain Data Science and ML talent.'
    ],
    requirements: [
      '15+ years in data science, ML engineering, or applied AI.',
      'At least 5 years of engineering management experience.',
      'Strong hands-on background in ML model development, MLOps, and production ML systems.',
      'Experience in fraud detection, anomaly detection, or risk modelling in payments or financial services.',
      'Familiarity with FeatureSpace or equivalent real-time ML platforms.',
      'Experience with AWS SageMaker and Bedrock.',
      'Proficiency in Python ML tools such as scikit-learn, XGBoost, TensorFlow, or PyTorch.',
      'Understanding of PCI DSS requirements for ML systems handling payment data.',
      'Proven ability to build and grow engineering teams in fast-changing environments.'
    ],
    preferredExperience: [
      'Real-time fraud prevention in financial or payment transactions.',
      'Experience deploying models with FeatureSpace and AWS SageMaker.'
    ],
    kpis: [
      'Zero production ML pipeline downtime',
      'Maintain fraud detection precision and recall targets',
      'Timely execution of MLOps drift and retraining cycles'
    ],
    idealCandidate: 'Engineering leader with a rigorous statistical foundation and proven hands-on capability in operationalising real-time fraud models and managing high-calibre data scientists.',
    tags: [
      'Data Science',
      'Machine Learning',
      'Python',
      'scikit-learn',
      'XGBoost',
      'TensorFlow',
      'PyTorch',
      'MLOps',
      'AWS SageMaker',
      'AWS Bedrock',
      'FeatureSpace',
      'Fraud Detection',
      'Anomaly Detection',
      'Risk Modelling',
      'GenAI',
      'PCI DSS'
    ],
    benefits: [
      'Opportunity to lead enterprise Data Science and ML teams.',
      'Ownership of production ML and MLOps initiatives.',
      'Exposure to fraud prevention, risk analytics, and GenAI.',
      'Opportunity to build teams and deliver AI-driven products.'
    ],
    selectionProcess: [
      'Technical Evaluation',
      'ML Architecture & Case Study Round',
      'Management & Culture Alignment'
    ]
  }
];

async function seedNewJobs() {
  await connectMongo();
  console.log('Connected to MongoDB.');

  for (const jobData of newJobs) {
    const existing = await Job.findOne({ $or: [{ id: jobData.id }, { slug: jobData.slug }, { title: jobData.title }] });
    if (existing) {
      console.log(`Updating existing job: ${jobData.id} - ${jobData.title}`);
      Object.assign(existing, jobData);
      await existing.save();
    } else {
      console.log(`Creating new job: ${jobData.id} - ${jobData.title}`);
      await Job.create(jobData);
    }
    registerDynamicJob(jobData.id, jobData.title);
  }

  const total = await Job.countDocuments();
  console.log(`All 9 roles successfully upserted! Total jobs in database: ${total}`);
  process.exit(0);
}

seedNewJobs().catch((err) => {
  console.error('Error seeding new jobs:', err);
  process.exit(1);
});
