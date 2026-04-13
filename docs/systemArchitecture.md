System Architecture
1. High-Level Architecture Diagram
We will use a Three-Tier Architecture (Client, Server, Database) with external service integrations for video and payments.

Code snippet

graph TD
    %% Clients
    subgraph "Client Layer (Frontend)"
        SA[Superadmin/Admin Portal]
        SP[School Dashboard]
        TP[Teacher Dashboard]
    end

    %% API Gateway
    LB[Load Balancer / API Gateway]
    
    %% Backend Services
    subgraph "Application Layer (Backend API)"
        AuthS[Auth Service]
        SchedS[Booking & Schedule Engine]
        UserS[User & School Management]
        BillS[Billing & Credits Logic]
        NotifS[Notification Service]
    end

    %% Data Layer
    subgraph "Data Layer"
        DB[(PostgreSQL Primary DB)]
        Redis[(Redis Cache - Active Sessions)]
        FireS[Firebase Storage (Files/Recordings)]
    end

    %% External Services
    subgraph "External Integrations"
        Zoom[Video API (Zoom/Agora)]
        Pay[Payment Gateway (Stripe/Bank)]
        Mail[Email Provider (SendGrid/SES)]
    end

    %% Connections
    SA & SP & TP -->|HTTPS| LB
    LB --> AuthS & SchedS & UserS & BillS
    AuthS & SchedS & UserS & BillS --> DB
    SchedS --> Redis
    SchedS --> Zoom
    BillS --> Pay
    NotifS --> Mail
    UserS --> FireS
2. Core Components
Client Layer (Frontend):

Tech Stack: React.js or Angular.

School Dashboard: Specialized interface for bulk management. Schools can view a calendar, select a teacher, and "assign" a slot to a specific student profile.

Teacher Dashboard: Simplified view focusing on "Upcoming Classes" and "Past Class Reports."

Admin Panel: Comprehensive view for Superadmins to manage the "Business" (Approving schools, setting credit rates).

Application Layer (Backend):

Tech Stack: Node.js (NestJS/Express) or Python (Django/FastAPI).

Logic:

School = User: In the DB, the usersTbl with type='school' acts as the master account for that institution.

Student = Data Object: Since students don't log in, they are treated as data entities (Name, Age, Level) stored within the appointmentTbl or a dedicated studentProfile table managed by the School.

Video Infrastructure:

The system does not host video. It generates Meeting Links (via Zoom/Agora API) when a booking is confirmed and stores them in meetingTbl.