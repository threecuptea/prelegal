# Prelegal

## Overview

Prelegal is a SaaS application that lets users draft legal agreements by chatting with an AI based upon predefined templates. The available documents are defined in `catalog.json` (12 Common Paper templates in `templates/`).  I copied the implementation of PL-2 and PL3 from [Ed Donnor's Prelegal](https://github.com/ed-donner/prelegal).  Also copied all his 7 Jira tickets and enhanced specs with additional architect design requirements like having clean separations of routes, services and models structures one central Pydantic model for all 12 templates in the backend. More importantly I harness it with the following additional features (I have totally 14 Jira tickets):

* Use previously saved documents as a template and make minor changes to generate new legal documents. That's common practice for legal documents.
* Add terraform configuration files to automate docker container deployment to Google's Container Run.
* Create a sub-domain linked to the Saas application [Prelegal App](https://prelegal.threecuptea.com/) thus it won't be subject to the service URL change due to terraform's removal and re-creation of Cloud Run Service. Cloud Run is serverless in nature and requires extra work to accomplish this.
* Migrate SQLLite to Postgres to make production records persistent.
* Replace home-made SignIn/ SignUp, Password Reset, JWT token generation and refresh work with Clerk User Authentication using OTP (Sending verification code to the email without requiring the password).  It is implemented using React App Router.

## Level up with Claude Code's feature-dev plugin of 7-phase processes

**1. Discovery**

**2. Codebase Exploration**

**3. Clarifying Questions**

**4. Architecture Design:**

**5. Implementation**

**6. Quality Review**

**7. Summary**

Clarifying Questions stimulates deep thinkings of some architect design issues and help detect the design flaws in a early stage.  The followings are some examples.

* There are the backend service and the frontend service.  Should we start two services or 1 service in dev and prod perpectively?  What is our production deployment model? Will we go for docker container deployment in production?
* There are 12 legal document templates. Each has its own required field. How do we model them? Do we use generic dictionaries? Do we Have 12 different Pydantic types so that we can have specific required fields or do we have one central model with shared/ common fields and section of optional fields for different document types?  The model design needs to be compatible with the design API end point(s).
* How do we load and re-construct documents?  Do we assign the title and field dictionaries internally and saved in the database? Then there is disconnection to actual title of a saved PDF.   How will a user be able to find the document that he/ she want to use it as a template?

**I enjoy feature-dev because I feel that I can be an engaging participant in architect design and development.**

Quality Review: agents in parallel with different focuses:

* **Simplicity/DRY/Elegance**: Code quality and maintainability
* **Bugs/Correctness**: Functional correctness and logic errors
* **Conventions/Abstractions**: Project standards and patterns

That detects critical bugs (the bug agent found out that `psycopg2` ignore the query param of Unix-style syntax that Cloud SQL happens to use ahead of the production deployment) and ensure high-quality codes consistent with project standard and patterns.

## Working with Claude Codes is a self-assertive and growing experience

Working with Claude Codes is not for faint of heart.  The entire `feature-dev` process can be intense.  You need to prepare yourself to stop Claude Code if you feel it goes astray or you are not comfortable with what directions it heads to. Claude Code is very good at reasoning. You have to elaborate/ articulate well what and why its design flaws are to convince it.  It is an iterative process until you and Claude Code reach the best solution.  You need to be self-assertive and know what you are doing to avoid being completly led by it.

I found out that I have to redo some architect design and features because I let Claude Code through without clarifying what would be implemented in the first few tickets. Yes, it often come back to bite.

## Elevate/ adjust yourself as a planner and architect

You are writing specs in Jira tickets and give clear instruction. You need to know what you are doing ahead of the process. Claude Codes will ask a lot of challenging questions in the **Clarify Question** phase.  Those decision might be critical to the product, the development and deployment.  Remember that you not Claude Code are ultimately responsible for updating/ maintaining products and you want to have a consistent design and architect across the board of all your products.  Claude Code can alleviate you from being bombarded with implementation details and have a quality of life.  However, you have to broaden yourself, and expand your horizon.

## Keep a balanced attitude. Be an engaging participant, learning from Claude Code and keep programming skill sharp

I consider Claude Code as an enthusiastic, tireless high IQ and tech-savy senior developer. I acknowledge that I have some techical deficiency compared with it.  I am humble, willing to learn and try my best to follow, and ask questions.

On the side, I have 10,000-foot view. I can see the inconsistency, gap and bad user experiences of design flaw that Claude Code are blind to. I also have intangible software development knowledge and business-context judgement.  I and AI coding can make up for each other.

Human beings tends to lay back when they are not responseible for a task. The mentality is that Claude Code will take care of everything.  There are two problems here.

1. You are still responsible for troubleshooting and maintaining the product. You better have the product know-how.
2. AI Coding is not omnipotent. AI models are subject to knowledge cut-off. It won't have up-to-date tech knowledge. AI engineers might still need to code ex. multi-agent orchestration, choosing the optimal RAG chunking strategies, choosing models of highest token count or apply OCR2 to parse PDF etc. Keep programming skills sharp.  They are needed.
