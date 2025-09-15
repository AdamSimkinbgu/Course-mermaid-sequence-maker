Course Catalog Prerequisite DAG Application – Technical Documentation

Introduction

This document provides a detailed technical overview of a web application and API for visualizing and managing course prerequisite structures. The system ingests university course catalog data (initially via Excel/CSV, later via PDF with OCR) and produces a Directed Acyclic Graph (DAG) of course prerequisites. The DAG is rendered as an interactive, editable diagram where each node represents a course and directed edges represent prerequisite relationships. The application supports manual editing of the graph, tracking of course completion status, and features like undo/redo, autosave, grouping, theming, and role-based sharing. The goal is to help students and advisors easily plan study paths, verify prerequisite fulfillment, and visualize optimal progression through courses. This documentation covers the system’s architecture, data models, key features, and implementation details, serving as a resource for developers (agents) working on the project.

Problem Context: Universities often publish prerequisites in inconsistent formats (PDFs, websites, etc.), making it difficult to parse and visualize the dependency structure of courses. Planning a degree path requires checking complex AND/OR prerequisite logic, which is cumbersome with static catalogs. Existing tools either require heavy manual setup, lack support for complex prerequisite logic, or do not offer interactive editing with real-time progress tracking. Moreover, extracting structured data from varied PDF formats (including scanned documents) is challenging. Therefore, there is a need for a reliable application that can ingest these course prerequisites and present them in a graphical, interactive format with minimal manual effort, while still allowing manual editing for accuracy.

Solution Overview: The proposed solution is a web application with a rich graph editor front-end and a supporting back-end. In the MVP (Minimum Viable Product), users can import course data from Excel/CSV or create courses manually, visualize the prerequisite DAG, and edit the graph with full persistence and version control. Subsequent phases will introduce PDF ingestion using OCR and AI for parsing, enhanced user experience features, and broader integrations. The application will ultimately provide:
	•	Interactive Graph Editor: A front-end interface (built with React + TypeScript) using React Flow for diagram rendering and editing. This supports drag-and-drop node creation, connecting edges, grouping nodes, and styling. Real-time layout algorithms (ELK or Dagre) arrange the graph automatically for clarity.
	•	Prerequisite Logic Handling: A formal grammar for prerequisites (supporting AND/OR logic) is defined, allowing complex prerequisite requirements to be represented. The system evaluates these expressions to highlight which courses are available or blocked based on completed prerequisites.
	•	Status Tracking: Users can mark courses as completed, in-progress, planned, or failed. The graph updates to visually indicate completion (e.g., green checkmarks) or unsatisfied prerequisites (e.g., grayed-out courses and edges) propagating through the DAG.
	•	Import/Export & Sharing: Data import is initially via a standardized Excel/CSV template. Export options include Mermaid diagram code, images (SVG/PNG), JSON data, and Excel (for round-trip editing). Graphs are saved on the server (PostgreSQL database) with the ability to export/import locally. Shareable links allow others to view or edit the graph, with role-based access control (viewer/editor/owner).
	•	Scaling and Future Enhancements: The architecture is designed to handle moderate graph sizes (~200 nodes, hundreds of edges) smoothly via virtualization and efficient layout. Later phases will integrate OCR and AI to parse PDF catalogs into the graph, with a human-in-the-loop verification step. The system also targets compliance with accessibility standards (WCAG 2.2 AA) and supports multiple languages (e.g., English and Hebrew, including RTL layout).

By following this documentation, developers should gain a comprehensive understanding of the system’s components and how to implement them. All major functional requirements, data models, and API endpoints are detailed below, along with design rationales and considerations for performance, security, and user experience.

System Architecture and Technology Stack

Overall Architecture: The application is split into a front-end client and a back-end server. The front-end is a single-page application (SPA) built with React and TypeScript, responsible for the user interface, graph rendering/editing, and local validations. The back-end is implemented in Node.js (running as serverless functions on Vercel) and uses a PostgreSQL database for persistent storage. The choice of serverless deployment (Vercel) and a serverless-friendly database (such as Neon or Supabase) enables easy scalability and reduces infrastructure maintenance. By integrating Neon (a serverless Postgres offering) with Vercel, we get a fully managed Postgres database that can autoscale and even scale-to-zero when not in use ￼, fitting the on-demand nature of serverless functions.

Front-end (Client):
	•	Built with React + TS, utilizing React Flow for graph visualization. React Flow is a library specialized for building interactive node-link diagrams and supports features like custom node types, edge interactions, zoom/pan, and more. We chose React Flow because it’s purpose-built for node/edge editing with high performance and flexibility (drag-and-drop, custom styling, etc.). The graph editor runs entirely in the browser, providing immediate visual feedback to user actions (like adding nodes or connecting edges).
	•	Layout Engine: To automatically arrange the graph (so that prerequisite arrows flow in a readable manner), we integrate an open-source layout library. The primary choice is ELK (Eclipse Layout Kernel) via its JavaScript port (elkjs), which excels at layered DAG layouts and can handle complex graphs with constraints. As a simpler fallback (or for users preferring faster, less fine-tuned layouts), Dagre is also supported. React Flow does not impose a specific layout; instead, we compute node coordinates by feeding the graph structure into ELK or Dagre and then update the React Flow nodes’ positions accordingly. ELK is more powerful and configurable, supporting dynamic node sizes and sub-flow layouts, whereas Dagre is more lightweight and faster for basic tree layouts ￼. Users can toggle the layout direction (Left-to-Right or Top-to-Bottom) and switch between ELK and Dagre in the UI. The layout algorithm can be invoked on demand or automatically on certain events (e.g., after a bulk import).
	•	State Management: The front-end maintains the graph state (nodes, edges, groupings, etc.), likely using React state or a state management library if needed for undo/redo (for instance, something like Zustand or Redux for history management). An undo/redo stack is maintained so users can revert mistakes. Autosave functionality periodically sends updates to the server (or saves to local storage if offline) to prevent data loss.
	•	Internationalization (i18n) & Localization: The UI will support English and Hebrew, including RTL text rendering. All UI strings are externalized for translation. The graph layout algorithm (ELK) will be configured or custom-adjusted for RTL when Hebrew is selected (e.g., perhaps reversing left-right orientation if needed). Dates, numbers, etc., will format according to locale. The interface will allow switching language at runtime.
	•	Accessibility: We strive to meet WCAG 2.2 AA guidelines for the UI. This includes ensuring sufficient color contrast for text and important visual elements (contrast ratio ≥ 4.5:1), keyboard navigability for all interactive controls (and the graph itself), focus indicators, and support for screen readers where applicable. Interactive elements like buttons and menu items will be at least 24×24 CSS pixels in size ￼ to meet the new WCAG 2.2 target size minimum requirement ￼. We will also implement features like “skip to content” links and avoid using color alone to convey information. The graph editor will support keyboard shortcuts and potentially a way to tab through nodes/edges in a logical order for non-pointer users. Additionally, we plan to allow navigating the graph via keyboard (e.g., using arrow keys or tabbing through a list of nodes) and providing textual descriptions of the graph for assistive tech if possible.

Back-end (Server and API):
	•	Implemented in Node.js, using either Express or a similar framework, but deployed as serverless functions on Vercel for each API route. This gives scalability and eliminates the need to manage a persistent server process. Each function handles a specific endpoint (as described in the API section). Since serverless functions are stateless and short-lived, we rely on the database for persistent state and use JWTs or session cookies for authentication.
	•	Database: PostgreSQL is used for storing all persistent data: user accounts, projects, graphs, nodes, edges, etc. A serverless-optimized Postgres solution like Neon or Supabase is used to ensure connection handling works with the ephemeral nature of Vercel functions. Neon, for example, provides a pooler and a WebSockets-based driver that is friendly to serverless environments, preventing the issue of too many open connections. The data model (detailed in a later section) is implemented via relational tables. We will use an ORM or query builder (e.g., Prisma, Knex, or Drizzle) for type-safe database access, considering that our needs include complex queries (like retrieving a whole graph with nodes and edges) and ensuring referential integrity (e.g., edges reference valid nodes).
	•	Server-side Logic: The server primarily provides a REST API for the front-end to load and save data. It enforces business rules (like checking permissions on each request), performs heavy computations if needed (though most graph logic is client-side), and handles import/export operations that may be too intensive or require access to secrets (like an OCR API key). For example, the Excel/CSV import could be processed either in the browser or via a server endpoint. In our initial design, we allow both: the client can parse and validate a CSV (for a quick feedback), or it can upload the file to the server to parse using a common library and then store the result. PDF ingestion (phase 2) will likely be initiated server-side (especially if using cloud OCR services or AI models) due to CORS and API key protection.
	•	Integration with OCR/AI: For phase 2, when implementing PDF ingestion, the server will coordinate the OCR and parsing pipeline. This may involve uploading the PDF, splitting it into pages, calling an OCR engine (either an on-device library like Tesseract.js or an external API like Google Vision or AWS Textract), then applying NLP or ML models to interpret the text. These tasks might run in a job queue or a separate service if they are long-running, since serverless functions have time limits. The design might include a job status endpoint that the client can poll.

Security and Deployment:
	•	The application will be deployed on Vercel (frontend as static assets, backend as serverless functions). We will use HTTPS everywhere. Authentication uses secure cookies (httpOnly, SameSite) for session tokens if using session-based auth, or tokens stored in memory if using a token-based approach. All sensitive data in transit (e.g., PDF contents for parsing) is sent over HTTPS to the server. Data at rest (database and any file storage) will be encrypted and backed up.
	•	We implement Authentication and Authorization (detailed later) to ensure only authorized users can access or modify data. Shareable links include capability tokens (random UUIDs or JWTs) that grant limited access (view or edit) without logging in, but those are constrained to specific graphs and optionally have expiration times.
	•	Development & Testing: We will maintain a comprehensive test suite. Unit tests will cover critical functions like the prerequisite expression parser and evaluator, graph validation (cycle detection), and permission logic. Integration tests (possibly using an in-memory or test database) will cover API endpoints and simulate various roles. End-to-end tests (using tools like Playwright or Cypress) will verify the UI for key user flows (importing a file, editing a graph, sharing a link, etc.). Code is continuously integrated (CI) with checks for linting, type correctness, and test passing before deployment.

The diagram below illustrates the high-level architecture (to be imagined, as text here): the React front-end communicates via REST API to the Node/Vercel back-end, which in turn interacts with the Postgres database. External services (OCR, OAuth providers for login) are integrated via the back-end.

[Diagram: High-level architecture with front-end, back-end, DB, and external OCR]

Functional Requirements and Features

1. Graph Creation & Editing

The core of the application is the interactive graph editor, which supports creating and modifying course prerequisite graphs. Key features include:
	•	Creating a New Graph: Users can start with an empty graph (creating courses manually) or import data from an Excel/CSV file to populate the graph (see Import/Export section for format). Each graph belongs to a project, which is essentially a workspace or collection of graphs under an owner (and possibly shared with others).
	•	Node Management: Courses are represented as nodes in the graph. A node typically displays the course code and name, and possibly additional info like credits or status icon. Users can add a new course node by dragging from a palette of node types or via a context menu. Node types include: Course Node (the main type), Group/Container Node (for grouping multiple courses visually or logically), and Note/Annotation Node (for adding textual notes on the diagram). After adding, the user can edit the node’s details (course title, credits, etc.) via a sidebar or modal form.
	•	Edge Management: Prerequisite relationships are directed edges from one course (source) to another course (target). To add an edge (prerequisite link), the user initiates a connection from a source node (e.g., clicking an “add prerequisite” handle on the node or a toolbar action) and then selects or creates the target node. The UI might allow drawing a connector line to an existing node to establish the link, or dropping it on empty space to create a new node as the target. If the user doesn’t complete the connection (e.g., presses Esc or drops on nothing), the action is canceled. Each edge can have an optional label or note (for cases like conditional requirements or minimum grade notes, etc.).
	•	Graph Editing: All editing actions support Undo/Redo. We maintain a history of changes, so users can experiment without fear. The state is auto-saved frequently (e.g., every few seconds or after each significant change) to both local storage and the back-end (if online) to ensure persistence. Users can also explicitly save or create named versions if needed.
	•	Grouping and Containers: The editor supports grouping nodes by certain attributes (department, course level, term/semester, etc.) for clarity. Groups might be represented visually as colored containers or sections of the canvas. For example, all Math courses can have one color, or all Year 1 courses are grouped in a collapsible container labeled “Year 1”. React Flow allows custom node types, so a Group node could be a special node that contains other nodes. Alternatively, grouping could be purely visual (like background swimlanes or sections) since the DAG relationships are what matter logically. We plan to support collapsible groups – e.g., the user can collapse a group node to hide its internal nodes and edges, which helps manage complexity for large graphs.
	•	Live Auto-Layout: As the user edits, the layout engine helps keep the graph organized. When a node or edge is added or removed, we can trigger a re-layout (with some throttle/debounce to avoid excessive computation). The user can also manually trigger auto-layout via a button. We provide a toolbar to switch layout direction: LR (Left-to-Right) or TD (Top-to-Bottom), which simply sets an option for ELK or rotates coordinates for Dagre. Users who prefer manual positioning can move nodes freely (dragging them) – the system will respect manual adjustments and possibly lock those positions (we might allow pinning a node). If a user has adjusted positions and then hits auto-layout, we might either override everything or attempt to merge (this is a detail to refine; likely auto-layout overrides but we could cache manual positions if needed).
	•	Visual Styling and Themes: Users can apply different themes to the graph (different color schemes for nodes/edges/background). We will provide a few default themes (e.g., light, dark, high-contrast for accessibility), and allow customization (possibly via CSS variables or a theme editor). Node appearance can also change based on data: e.g., completed courses might appear with a green outline, failed courses with a red outline. The interface will allow toggling certain visual options, like showing/hiding course codes vs names, badge displays for credits, etc. Custom badges can be displayed on nodes (small icons or text, such as credit hours or course level indicators).
	•	Status Tracking: Each course node has a status property indicating the student’s progress: Completed, In-Progress, Planned, or Not Taken/Unknown (and possibly Failed if a course was taken but not passed). This status can be set by the user (e.g., by clicking the node and toggling status). The status has visual effects:
	•	Completed courses might show a green checkmark icon on the node.
	•	Failed or not completed courses that were attempted could show a red cross icon.
	•	Courses that are not yet completed will cause their dependent courses (those that require them) to appear “unavailable” – typically by graying out those dependent nodes and/or the edge leading to them, indicating the prerequisite is not satisfied. In contrast, if all prerequisites of a course are met (courses completed), that course node could be highlighted to show it’s now available to take. This real-time eligibility highlighting helps users see what courses they can take next.
	•	If a course is in-progress or planned, the behavior might be similar to not completed (since it’s not completed yet, future deps are still locked), but we may differentiate in color or icon (e.g., in-progress could have a half-filled icon).
	•	Progress and Metrics: The app can compute summary metrics like total credits completed, average grade (if grades were input, though the initial model doesn’t include grades, only statuses), credits per semester, etc. These could be displayed in a dashboard or on the graph (perhaps as annotations on group nodes like year/term). For example, if grouping by year, the group container might show “Credits completed: X / Y required”. We can also allow the user to input their grades or GPA for completed courses to compute weighted averages if that’s a desired feature (the spec mentions “credit-weighted averages” which could imply tracking grades to compute GPA per group). This is not fully fleshed out in the requirements, but it’s an optional enhancement.

Validation during Editing: The system will continuously validate the graph as it is edited:
	•	DAG Integrity: We ensure the graph remains acyclic. If the user tries to create an edge that would introduce a cycle (a circular prerequisite), the action is disallowed and an error notification is shown. The cycle detection logic can run via a depth-first search or topological sort algorithm whenever a new edge is added.
	•	Dangling References: If an edge’s source or target references a non-existent course (should not happen through normal UI, but could via import), it will be flagged. Likewise, if a course references a prerequisite in its expression that is not defined as a node, that’s a missing reference error (the import logic or expression parser will catch those).
	•	Orphan Nodes: An orphan could mean a course that isn’t connected to others. That’s not inherently wrong (e.g., a course with no prerequisites that nothing else requires), but we may highlight it for user review. Unreachable nodes (nodes that have prerequisites that are impossible to meet due to a missing chain) might also be flagged. The system can run a reachability check from “start” nodes (courses with no prereqs) to ensure all nodes are reachable; if not, some are effectively dead ends unless prerequisites are adjusted.
	•	Prerequisite Expression Validation: (Detailed more in the next section) – when the user edits a course’s prerequisite expression (for complex prerequisites logic), the expression is parsed and checked for syntax, unknown course IDs, etc. Any errors are shown so the user can fix them.

2. Prerequisite Logic (AND/OR Conditions)

One of the standout features of this application is the ability to handle complex prerequisite logic, not just simple single-course prerequisites. Courses can have requirements like “Course A AND Course B” or “(Course C AND Course D) OR Course E” and so on. We address this by defining a clear expression grammar for prerequisites and incorporating it into both the data model and the UI.
	•	Prerequisite Expression Grammar: We introduce a mini-language to represent prerequisites. In the simplest form, a prerequisite can be a single course code (e.g., MATH101). We allow combining them with logical AND and OR, using parentheses for grouping. The grammar can be summarized as:
	•	Tokens:
	•	COURSE_ID – represents a course by its identifier (e.g., MATH101). We assume course IDs have no spaces and perhaps are alphanumeric with maybe dept code and number.
	•	AND, OR – logical conjunction and disjunction operators.
	•	Parentheses ( and ) for grouping.
	•	We might also allow a special token like NONE or NULL to indicate no prerequisites.
	•	Syntax Rules (EBNF-style):
	•	<expr> ::= <term> ( "OR" <term> )* – an expression is one or more terms separated by OR.
	•	<term> ::= <factor> ( "AND" <factor> )* – a term is one or more factors separated by AND. (This implies AND has higher precedence than OR.)
	•	<factor> ::= <COURSE_ID> | "(" <expr> ")" – a factor is either a course ID or a parenthesized sub-expression.
	•	The grammar assumes course IDs themselves do not contain the keywords “AND” or “OR”.
	•	Examples:
	•	MATH101 – Course requires MATH101.
	•	MATH101 AND MATH102 – requires both courses.
	•	(MATH101 AND MATH102) OR PHYS100 – requires either the combination of MATH101 and MATH102, or the single course PHYS100.
	•	NONE – no prerequisite (this could simply be an empty expression or a placeholder text to explicitly denote no prereq).
	•	We will implement a parser for this grammar. This could be a simple recursive descent parser or a small tool/lexer given the simplicity of the language. The output of parsing will be a normalized Abstract Syntax Tree (AST), which we can store or use for evaluations. For instance, the AST could represent AND/OR nodes with course leaves.
	•	The parser will also perform validation: ensuring every course ID mentioned in the expression corresponds to an existing course in the graph (or at least flag it if not). It will check for proper parentheses matching and valid token sequences. If the user enters an invalid expression, we provide a clear error message (e.g., “Expected course ID after ‘AND’ at position 10”, or “Unknown course code CHEM999 in prerequisites”).
	•	Storing and Using Expressions: In the data model, each course node can have an associated prerequisite expression (stored as a string, and possibly the AST or a compiled form). When importing from Excel/CSV, we’ll parse the provided expression text. In the graph, an edge structure alone is not enough to represent AND/OR (since a simple directed edge implies an AND of one, basically). We handle this by using edge grouping or extra metadata:
	•	One approach: edge grouping ID – If a course has an OR between prerequisites, we can create multiple incoming edges that are marked as alternatives (grouped by an ID). For example, for (A AND B) OR C, we might have edges from A->X and B->X grouped together (meaning A AND B), and another edge from C->X with a different group (meaning alternative path). This way, the front-end could potentially visualize the AND group as a fork that meets at a node (though React Flow doesn’t have a native AND junction symbol, we might simulate it by special styling or an explicit small node representing the group).
	•	Alternatively, we keep the expression separate and use it purely for validation and user display, while the actual graph edges are drawn from each prerequisite course to the target course. In that case, multiple edges into one course represent an AND by default (all must be completed), and we might have to indicate OR logic by annotating edges or something. The UI could show an OR by, for instance, drawing a curved line or an OR label on a set of edges. The details of visualization might evolve, but the underlying logic will use the expressions for determining eligibility.
	•	We will maintain a PrereqExpression entity (as seen in the data model) that ties a course to its expression string and possibly a normalized AST or postfix notation for quick evaluation.
	•	Evaluating Prerequisites (Eligibility): Given a set of completed courses for a student (i.e., statuses in the graph), we evaluate each course’s prerequisite expression to determine if it’s satisfied. This can be done by a simple recursive function on the AST:
	•	A COURSE_ID node evaluates to true if that course is marked completed (or in-progress, depending on whether in-progress counts as satisfying the prereq – likely not until completed).
	•	An AND node evaluates to true if all children evaluate to true.
	•	An OR node evaluates to true if any child is true.
	•	If an expression is empty or explicitly NONE, it’s considered true (no requirement).
We use this logic in the UI to, for example, add a CSS class to nodes that are not yet available (if their prereq eval is false) vs available (true). We also might proactively disable “Add to plan” actions for courses not yet available, etc., though viewing is still allowed.
	•	Displaying AND/OR in UI: The editor will allow the user to input prerequisite expressions either via a text field or a structured UI. We might have a small UI to add prerequisites one by one and choose whether they are AND/OR related. However, a text input following the grammar might be the simplest for MVP. We will display the parsed expression back to the user in a friendly form as well (maybe highlighting course codes, etc.). Also, when exporting to Mermaid or other formats, we need to translate these into a visual structure:
	•	Mermaid Export: Mermaid supports flowcharts but doesn’t natively understand an AND gate. We might represent (A AND B) -> C by introducing an intermediate node in Mermaid like A --> C and B --> C (which implies AND). For (X OR Y) -> Z, we might just draw both X --> Z and Y --> Z with a note that either suffices, or use a Mermaid subgraph or special notation if any. This is a bit of a creative aspect – the simplest is to just draw edges for all prereqs and not explicitly denote AND/OR in the diagram (aside from maybe labels).
	•	Editing Expression: If a user edits the graph by adding/removing edges, we will need to update the expression accordingly. For example, if a course had no prereqs and the user draws two edges into it from A and B, do we assume that means A AND B? Likely yes. If the user then draws an edge from C as well, maybe we prompt whether it’s an AND or if C is an alternative OR. Possibly, the UI should default multiple edges to AND but allow user to toggle an edge to “OR-group” via a property. A more advanced UI might let them visually cluster edges to indicate OR groups.

In summary, the application has a robust mechanism to capture complex prerequisite logic through a custom expression grammar, which is parsed and validated. This ensures that even if universities phrase requirements in free text, we have a structured way to represent them once known. The graph model plus expressions together fully capture prerequisite rules. Developers implementing this should create the parser and integrate it into both import (to parse spreadsheet inputs) and UI editing (to parse user-entered expressions). Extensive testing should be done with various expressions to ensure correctness.

3. Data Import/Export

Supporting various import and export formats is crucial for interoperability and ease of use. In the MVP, the focus is on Excel/CSV import for structured data, along with multiple export options. Phase 2 will introduce PDF import with OCR and AI parsing. Below are the details for each:
	•	Excel/CSV Import (MVP): We define a single-sheet Excel format that users (or university admins) can fill with course data. This provides an easy “on-ramp” to using the tool, as many catalogs can be transformed into a spreadsheet. The expected schema (columns) for the spreadsheet is:
	1.	course_id – a unique identifier for the course (e.g., CS101, MATH-1001). This will be the primary way prerequisites refer to courses. It’s important that these are consistent and unique within a project.
	2.	course_name – the human-readable course title (e.g., “Introduction to Computer Science”).
	3.	credits – the credit value or credit hours for the course (could be an integer or decimal depending on the system, we’ll confirm with stakeholders if half-credits exist or all are integer). We assume a simple numeric value.
	4.	department – a short code or name of the department (e.g., MATH or Mathematics). This can be used for grouping or coloring.
	5.	level – maybe the year or level (e.g., 100 for first-year, or Graduate, etc.). This is optional but useful for grouping/filtering.
	6.	term – the term in which the course is offered or typically taken (e.g., Fall, Spring, or Semester 1, Semester 2, etc.). We plan to allow configuring this per project (for example, some schools have 2 semesters + summer, others 3 trimesters, etc.). For MVP we might allow free text or a set of expected values (like Fall/Spring).
	7.	prereq_expression – a prerequisite expression following the grammar described above. Alternatively, the project plan mentioned possibly a simpler prereq_course_id_list (semicolon-separated list) for basic cases, but the consensus was to go with the expression approach to cover AND/OR. We may still support a simple list for “all must be taken” by interpreting a list as AND, but it’s likely unnecessary if users can just use AND.
An Excel template will be provided to users with these columns and examples (and perhaps data validation rules or comments to guide filling). We will accept both Excel .xlsx files and CSV (comma-separated values) for import. The import workflow:
	•	The user selects their file to upload via the UI.
	•	The file can be processed on the client side using a library like SheetJS (xlsx) or the browser’s built-in File APIs, to parse the content and do a first pass validation. This avoids a round trip and can give immediate feedback (especially if the file is small).
	•	Validation checks on import:
	•	Required columns present, no duplicate course IDs, all prerequisite references exist in the set, expressions parse correctly, numeric fields are valid, etc.
	•	If any errors, show the user a list of issues (e.g., “Row 10: prereq_expression references unknown course MATH999” or “Row 5: credits is not a number”).
	•	If client-side validation passes, we then send the data to the server (as JSON or the raw file) to save into the database. The server will repeat validation (never trust only the client) and then create the appropriate records in the database for the courses, edges, expressions, etc., under a new graph entry.
	•	Upon success, the front-end navigates to the graph editor view for the newly created graph.
	•	We also allow creating a new project or selecting an existing project to import the graph into (since a user might have multiple projects, say one per university or per degree program).
	•	PDF Import (Phase 2): This is a challenging but high-value feature. The goal is to ingest course catalogs directly from PDF files, even if they are just digital printouts or scanned documents. Our approach:
	•	OCR (Optical Character Recognition): If the PDF is scanned (contains images of text), we need to run OCR to get machine-readable text. We will use Tesseract.js for in-browser OCR for smaller documents (Tesseract.js is a JavaScript port of the Tesseract OCR engine that can run in the browser or under Node ￼). For larger documents or if the user opts in (since it may involve sending data to a third party), we might use cloud OCR APIs like Google Vision or AWS Textract for better accuracy. By default, to respect privacy, we could do OCR client-side with Tesseract, which means the user’s machine does the processing and no document content is sent to our server until text is extracted. Tesseract.js supports many languages (over 100) and can auto-detect text orientation ￼, which is useful if the PDFs have rotated text. However, OCR can be slow in JS, so for big catalogs users might prefer cloud OCR.
	•	Text Parsing: Once we have raw text from the PDF, we need to extract structured information: course IDs, names, credits, and prerequisites. University catalogs vary widely in formatting. Some have well-structured tables or consistent layouts, others are free-form text. Our strategy is rule-based with AI assistance:
	•	Use heuristics and regex to find patterns like course codes (e.g., a regex for something like [A-Z]{2,4}\s?\d{3} might find “CS 101”, etc.), course titles (often on the same line), credits (maybe in parentheses or after the title), and prerequisite text (often following the word “Prerequisite:” or similar).
	•	For structured layouts or ones with consistent punctuation, this might be enough. We can implement a pipeline that goes line by line or uses the PDF’s internal structure if available (some PDFs have text elements in order).
	•	For more complex or free-form prerequisite descriptions, we can incorporate an AI parsing step. For instance, we could use a small language model or a prompt to parse “Prerequisite: Completion of MATH 101 and either PHYS 100 or CHEM 110” into our structured expression (MATH101 AND (PHYS100 OR CHEM110)). This could be done via an API like OpenAI or a locally running model if feasible. However, because AI can make errors, we treat this as “assistant” rather than fully automatic.
	•	Human-in-the-loop: After the automated parsing, we will present the user with a review interface. This might show a table of what we extracted vs. the original text side by side. The user can verify if course names, codes, and prerequisite expressions were correctly interpreted. They can manually fix any mistakes in this step. Only after confirmation do we save the data and create the graph. This ensures the user remains in control of the final data quality, which is important given the variability of input.
	•	The parsed data from PDF will fill the same model (courses with expressions). We may allow partial imports too (if the user wants to OCR just a page or section).
	•	Export Options: We want users to easily share or use the graphs outside the app. The export features include:
	•	Mermaid Code Export: The app can generate a Mermaid diagram definition representing the prerequisite graph. Mermaid is a popular text-based diagramming tool where you can write Markdown-like syntax to describe graphs, and it will render them ￼. By providing Mermaid export, advanced users can tweak the diagram or include it in documentation (like in Markdown files, GitHub wikis, etc.). Our export will likely produce a flowchart diagram definition. For example:

flowchart LR
  CS101[CS101 Intro to CS]
  MATH100[MATH100 Algebra] --> CS101
  ENG200[ENG200 Writing] --> CS101

This is a simple example where CS101 has two prerequisites. We will include subgraphs in Mermaid if we want to represent groups (Mermaid supports subgraph blocks to group nodes). We will have to decide how to encode AND/OR: Mermaid itself doesn’t have an explicit AND node, but we might do something like:

flowchart LR
  subgraph "AND condition"
    MATH101 & MATH102
  end
  MATH101 --> AND_node
  MATH102 --> AND_node
  AND_node --> PHYS200
  PHYS100 --> PHYS200

and maybe label the AND_node accordingly. Or simply document outside of Mermaid that multiple arrows imply AND by default. Regardless, the Mermaid export should result in a diagram that at least shows all the prerequisite connections. The user can refine it if needed.

	•	Image (SVG/PNG) Export: Users can export the current graph view as an image (SVG for scalable vector, or PNG for easy insertion into slides/docs). This likely will be done client-side by using the DOM SVG of React Flow (since React Flow nodes/edges can be rendered as SVG or HTML – if HTML, we might need a different approach like html-to-canvas). Perhaps React Flow or an utility can give a snapshot. We will ensure that even large graphs can be exported (so maybe we temporarily zoom to fit and then capture).
	•	JSON Export: The graph can be exported to a JSON file containing all the node data, edges, and expressions. This allows offline storage or transfer. It would include all fields (like positions if any, status, etc.). The JSON schema can be our internal representation (which basically mirrors the data model objects). This also serves as a backup mechanism.
	•	Excel Export: Essentially the inverse of import – we can export an Excel file in the same template format with all current data. This ensures a round-trip capability: a user could export, manually edit in Excel (for bulk changes perhaps), and re-import. This is a convenient way for users who prefer spreadsheets to maintain their data but still use our tool for visualization. We must ensure the export uses the exact template structure and escapes any special characters (like if a course name contains a comma and we output CSV, handle quoting properly).
	•	Editable Mermaid Editor (Bonus): A potential bonus feature (mentioned in requirements) is to have a panel in the app where users can view the Mermaid code of their graph and even edit it, then see those changes reflected back in the graph. This is tricky because Mermaid’s syntax might not capture 100% of our data (especially AND/OR logic) unless we extend it or restrict editing to a subset. It’s also somewhat duplicating functionality of our own editor. However, providing a read-only Mermaid view is straightforward. A fully editable synchronized Mermaid could be a nice power-user feature for those who like to script their diagrams.

All import/export operations that involve the server (Excel/PDF import, image export if done server-side) will be exposed via API endpoints (documented in the API section). We will also carefully handle file sizes and timeouts (e.g., for large PDFs, we might need an asynchronous process). The UI will give feedback (like a progress bar for import parsing, etc.).

4. Persistence & Sharing

All user-created data (projects, graphs, etc.) is persisted on the server, allowing users to access their graphs from any device and share them with others. Here we outline the data persistence model and sharing capabilities:
	•	Data Model: The primary entities stored are: User, Project, Graph, CourseNode, Edge, PrereqExpression, Membership, ShareLink. The relationships are as follows:
	•	A User represents an account (with fields like id, email, display_name, auth_provider, locale, etc.). Users can own projects and have access to others’ projects via membership.
	•	A Project is a container for one or more graphs, typically corresponding to an institution or a specific context. For example, a user might create a project for “Computer Science Department Catalog 2025” and have multiple graphs within (maybe different curricula). Each project has an owner (the user who created it) and possibly a description. The project is the unit at which we manage permissions (ACL).
	•	A Membership links a User to a Project with a certain role (viewer, editor, or owner). The owner is usually the creator but can transfer ownership. Editors can make changes; viewers can only view. This membership is how we implement collaborative access.
	•	A Graph represents a specific prerequisite graph (basically the diagram). Fields include an id, reference to the Project it belongs to, version info (if we implement versioning), and maybe layout or theme preferences stored as JSON (for example, the chosen layout orientation, last known zoom level, selected layout engine, active theme, etc.). A graph is composed of nodes and edges.
	•	A CourseNode corresponds to a course in the graph. Key fields: id (primary key), graph_id (parent graph), course_id (the code, like “MATH101” – unique within the graph), title (course name), credits, department, level, term, status (completed/in-progress/etc.), badges (maybe a JSON or array of extra markers/tags), notes (any free-form note the user attaches). The id vs course_id: id is an internal database ID, whereas course_id is the user-facing code. We use course_id in expressions since it’s easier to reference than an internal ID.
	•	An Edge represents a prerequisite link. Fields: id, graph_id, source_id (course node id of prerequisite), target_id (course node id of the course that has the prerequisite), label (text label, rarely used but could note things like “must be concurrent” or specific grade requirements), notes (longer text if needed), grouping_id (to group edges that form an AND group, or possibly OR group – how we use this is as discussed in the prerequisites section), and metadata (possibly JSON for any future extensions). The combination of all edges for a given target course, plus the expression, determine the logic. We ensure in code that for each course that has a prerequisite expression, the edges coming in correspond to the atomic pieces of that expression.
	•	A PrereqExpression entity ties to a specific course (by course_id or node_id) and stores the expression string and maybe a precomputed normalized_ast (JSON structure) and a validation_state (e.g., valid, error at position X, etc.). This might be somewhat redundant since the expression is also derivable from edges if structured, but we keep it for accurate round-trip of how user input it and to allow quick editing of the text form.
	•	A ShareLink is used for generating shareable URLs. Fields: id, graph_id, capability (viewer or editor), token (a random string or UUID that is part of the URL), expires_at (optional expiry date). When someone accesses the app via a share link URL (like https://ourapp.com/share/XYZ123), the backend will look up the token, ensure it’s valid and not expired, and then allow access to the associated graph with the specified permission level. We might implement share links as JWTs to avoid a DB lookup (embedding graph id and role in an encrypted token), but storing in DB gives more control (like revocation).
	•	Project & Graph Ownership: The project owner (and any editors) can create and modify graphs within the project. If a user is removed from a project, they lose access to its graphs unless a share link is given. We enforce that only owners or editors can save changes to a graph. Attempting to edit as view-only will be disabled in the UI and double-checked on the server.
	•	Server-side Persistence: The app uses Postgres to store the above entities. We ensure foreign key relationships (e.g., CourseNode graph_id links to Graph, Edge source_id/target_id link to CourseNode, etc.) for data integrity. All writes (creating or updating a graph) go through the API and require proper authentication and authorization. We plan to implement some form of soft deletion for safety – e.g., if a user deletes a graph or project, we might mark it deleted but keep it for a period for potential recovery (especially if accidentally deleted).
	•	Autosave and Versioning: Every edit in the client can be sent to the server to update the database. However, we have to be mindful of not flooding with too many requests (e.g., dragging a node might produce many position changes – those we might batch or ignore since positions are aesthetic). We could autosave at intervals (say every 5 seconds or 10 seconds of inactivity). Also, maintaining an edit history on the server can be useful (e.g., keep a version number or even a history of changes per graph). For MVP, a simple approach is to overwrite the graph state on save, maybe keeping a updated_at timestamp. For more robust version control, we might have a GraphVersion table to track changes, which would allow “undo” even across sessions or a history view of past versions. This is not explicitly required, but something to consider for collaboration (especially if multiple editors – though real-time simultaneous editing is not in scope initially, editors might take turns and want to see who changed what).
	•	Sharing & Permissions: Sharing is implemented via both the membership system and shareable links:
	•	Inviting Users: An authenticated user (owner of a project) can invite others by email to collaborate on a project. The system will either create a new user (with a sign-up flow) or if the email exists, directly add that user to the project with the chosen role. Invitations could be managed via a token as well, but typically simply adding to membership and emailing a link is enough.
	•	Roles:
	•	Owner – full control (can edit, share, delete, manage membership).
	•	Editor – can edit graphs and perhaps create new ones in the project, but cannot delete the project or manage other users.
	•	Viewer – read-only access. They can open graphs and view all details, but the UI will not allow editing actions (and the server will reject any attempt to modify).
	•	The UI should reflect the role: e.g., a viewer accessing a share link will see the graph in a view-only mode (no palette, no drag to create, maybe an indicator “View Only”).
	•	Shareable Link: For quick sharing (especially read-only), the app provides a way to generate a link that can be sent to others. When an owner/editor creates a share link, they specify the permission (view or edit) and optionally an expiration date. The system generates a random token and stores it with that info. The recipient can use the link without logging in (we’ll treat that link as an anonymous identity with specific access). Under the hood, when the front-end hits the share link route, it will call an API like GET /api/share/:token, which checks the token and returns either a one-time session or direct access to the graph data if valid. We will likely create a temporary session for the share-user so that the standard APIs can be used with limited scope (for instance, we might issue a JWT that contains something like shareToken:XYZ, graph:123, role:viewer to allow them to use the normal GET graph endpoint).
	•	For security, share tokens should be sufficiently long/unpredictable and we might allow revoking them (so a project owner can disable a link if it was shared accidentally with the wrong people, etc.). Also, a share link with edit capability is risky to give out, but it might be useful for say group project work without forcing sign-up.
	•	Privacy Considerations: By default, we assume all projects/graphs are private to the creator and explicitly shared people. We do not list graphs to anyone who isn’t authorized. If we implement any analytics or error logging, we ensure no personal or sensitive data (like course content maybe not sensitive, but user email, etc.) leaks. The requirement states “privacy: default to on-device processing for rendering and Excel import; PDF AI parsing opt-in and clearly labeled; minimal data stored on server; encryption at rest and in transit”. Concretely, this means:
	•	We don’t send Excel data to server until user explicitly wants to save; the user could do an entire analysis client-side if they choose (but then they wouldn’t have the persistence or sharing).
	•	PDF OCR that uses AI (cloud) will prompt the user that their document will be sent to, say, Google’s API, for processing, so they can consent or cancel.
	•	On the server, all sensitive info (like user passwords, emails) are stored securely (passwords hashed with a strong algorithm like Argon2id, emails maybe encrypted if we want zero-knowledge, but probably not necessary).
	•	Database encryption at rest depends on the DB provider (many cloud DBs encrypt by default, and we can add application-level encryption for certain fields if needed).
	•	All communication is over HTTPS. We will use CSRF tokens for forms or same-site cookies to protect against cross-site attacks for state-changing requests.

In summary, persistence is handled via a robust relational model in Postgres, and sharing is facilitated by a combination of user roles and special share links, all enforced by the back-end. This ensures that multiple users can collaborate and the data is safely stored and accessed according to permissions.

5. User Accounts & Security

The platform includes a user account system and various security measures to protect data. Below are the details on authentication, authorization, and other security aspects:
	•	Authentication (AuthN): We offer multiple ways for users to create accounts and log in:
	•	Email/Password: Users can sign up with an email and password. Passwords are never stored in plain text – we hash them (using a strong algorithm like Argon2id or bcrypt with a high cost factor) before storage. During login, we hash the provided password and compare with the stored hash.
	•	OAuth (Google, Microsoft, etc.): Many students and staff may prefer using existing accounts. We plan to integrate OAuth login for Google and Microsoft initially. Using OAuth will allow quick onboarding without managing another password. We’ll use secure OAuth flows (likely Authorization Code Flow with PKCE for single-page applications) to get an identity token from the provider, then either map that to a user record in our database or create one if new.
	•	We may add others like GitHub or university SSO if needed, but Google/Microsoft covers a lot of users (especially if universities use Google Apps or Office 365).
	•	Session Management: After authentication, the user needs a session to make authenticated requests to the API:
	•	We prefer using HTTP-only cookies to store a session token (to avoid exposing tokens to client-side JS which can prevent some XSS attacks). The cookie will have the Secure and HttpOnly flags, and SameSite set to Lax or Strict to mitigate CSRF (we will also implement CSRF tokens as double protection for state-changing requests).
	•	The session token could be a JWT signed by our server, containing the user ID and maybe roles, etc. Or it could be a random session ID that is looked up in a server-side store (though in serverless, a stateless JWT is easier). If using JWT, we will keep it short-lived (with refresh tokens or re-login periodically) to reduce risk.
	•	Share links as mentioned might bypass login – in such cases, we issue a temporary JWT with limited scope.
	•	Authorization (AuthZ): Every API route will enforce access control:
	•	We will decode the session token or check the session to identify the user (or map a share token to a limited identity).
	•	For project-scoped operations (most of them), we verify the user has the necessary role on that project. For example, if an API call is POST /api/projects/:id/graphs (create a graph in project), the user must be at least editor on that project. If they are viewer, they get a 403 Forbidden.
	•	For graph-specific operations like editing a graph (PUT /api/graphs/:id), we find which project that graph belongs to and check the role.
	•	Special cases: When using a share token, the token itself encodes the access (so if someone is using a share link, the server knows they are not a full user but an external with viewer/editor rights on that one graph – they should not be able to list all projects or do anything outside that graph).
	•	We also ensure that users can only access resources they own or are shared. For example, /api/projects/:id (get project details) should not leak info if you’re not a member. We likely will not expose any user data to other users except maybe display name on collaborative projects.
	•	Secure Practices:
	•	CSRF Protection: For any state-changing requests (POST/PUT/DELETE), if we use cookies for auth, we will include a CSRF token mechanism. The server can issue a token (e.g., in a cookie or via an endpoint) and the client must send it back in a header (X-CSRF-Token) for any modifying request. This ensures that if the user is tricked into clicking a malicious link, the request will lack the correct token and be rejected.
	•	Input Validation & Sanitization: All API inputs (query params, body data) are validated to prevent injection attacks. Using parameterized queries via an ORM or parameter binding prevents SQL injection. We also need to be careful with the prerequisite expression language – because if we eventually allow some sort of more complex logic, but since it’s custom and not executed in a DB directly, risk is low. Still, we ensure it can’t be abused to read other data (not likely since it’s just course references).
	•	XSS Protection: On the front-end, we’ll be careful when rendering any user-provided text. Course names, notes, etc., should be escaped in HTML to prevent injection of scripts. Using React largely handles XSS by escaping content by default, as long as we don’t dangerously set HTML. We also avoid storing any HTML in the database; notes fields can be plain text or a limited markdown at most.
	•	Password Security: As mentioned, strong hashing for passwords. Possibly add requirements for password strength (min length, etc., though many modern sites rely on just strength meters).
	•	Rate Limiting: We will implement basic rate limiting on sensitive endpoints like login and password reset (to prevent brute force), and perhaps on share link access to prevent someone trying many tokens. Vercel serverless functions can integrate with solutions like Upstash Redis or use Vercel’s middleware for simple rate limit. Also, after several failed login attempts for an IP or account, introduce a delay or captcha if needed.
	•	Audit Logging: Important actions like permission changes (adding/removing members, generating or revoking share links, deleting a project) could be logged for auditing. This can help in case of misuse to trace what happened. These logs might just be console or external service logs if needed.
	•	Compliance: If this app were to be used in an environment with student data, we might consider FERPA (for US) or GDPR (for EU) implications. However, our app mostly contains course info, not really personal data besides user accounts. We keep minimal PII – essentially just email and maybe name for accounts. We’ll have a Privacy Policy stating what we do. If we integrate analytics, we make it opt-in and anonymized. The spec mentions minimal metrics: perhaps collecting performance metrics (like graph render time, usage of features) for improving the app. We will ensure those metrics do not include personal identifiers unless the user consents.

In summary, the security design ensures that only authorized users can access or modify data, sessions are handled safely, and common web vulnerabilities are mitigated. The system balances ease of sharing (with shareable links) and safety (through expiring tokens and strict role checks).

6. Analytics & Metrics (Minimal)

Although not a core feature, we plan to include a minimal analytics system, mainly to track performance and usage patterns for improvement:
	•	This will be opt-in or at least privacy-preserving (no personal data). For example, we might have a toggle “Help improve by sending anonymous usage stats”.
	•	Metrics could include things like: time taken for graph layout computation, render FPS (if we measure), number of nodes/edges in graphs (to identify typical sizes), feature usage (e.g., how many use the PDF import or Mermaid export).
	•	We would collect these perhaps via a simple logging to our backend or an analytics service. Given the audience is technical and possibly privacy-sensitive (students, universities), we will be transparent about what we collect.
	•	No PII (like course names might not be PII, but if someone enters custom notes that include names, we wouldn’t collect those anyway). We likely just aggregate counts and timings.
	•	This is more for internal use to refine the product (for instance, if we see most graphs have < 50 nodes, we know our performance is fine; if some have 500 and struggle, we might prioritize optimizations).

This section is small because indeed, analytics is minimal and not a user-facing feature beyond perhaps a checkbox to enable/disable.

Non-Functional Requirements and Considerations

Beyond the core features, the system is designed with several non-functional goals in mind: performance, scalability, accessibility, internationalization, and maintainability. Here we detail how the design meets these:

7. Performance and Scalability

The application should remain responsive and smooth even as the graph size grows and multiple users interact.
	•	Graph Size Handling: Target performance is to handle graphs up to about 200 nodes and 400–800 edges comfortably on a typical device. All operations (pan/zoom, select, edit) should be smooth at 60fps if possible. React Flow is built for performance; it uses a canvas/SVG under the hood and only re-renders parts of the graph that change. We will leverage its virtualization features – for example, if the graph is extremely large, not all elements off-screen need to be in the DOM. If needed, we can implement windowing so that only visible portion of the graph is rendered (though at 200 nodes, likely not needed, but at 1000 it might be).
	•	Layout Computation: Automatic layout (especially ELK) can be expensive for large graphs. We aim for layout computation under ~1 second for typical graphs. ELK’s complexity can grow with nodes; if performance becomes an issue, we might:
	•	Compute layout in a web worker thread to avoid blocking the UI.
	•	Cache layout results. For example, if only a small part of the graph changed, maybe adjust incrementally instead of full recompute (though that’s complex, so likely full recompute each time is fine for MVP).
	•	Allow the user to disable auto-layout if they prefer manual or if it gets slow, with a button to manually trigger it.
	•	Server Scalability: Using serverless ensures we can handle sporadic bursts of usage without a dedicated server bottleneck. Each request spins up isolated compute, and the database is the main shared resource. We must ensure the database can handle concurrent requests – using connection pooling (Neon’s serverless driver manages this) and efficient queries. We will index important fields (like looking up by project id, graph id, etc.).
	•	Asset Delivery: The front-end will be a static bundle. We’ll optimize it (code splitting, tree shaking) to ensure quick load. We might use caching strategies (service worker maybe for offline capability in the future).
	•	Large File Handling: Excel or PDF imports could be large (tens of MB). We’ll implement streaming or chunking if needed. For example, parse CSV line by line instead of loading whole file in memory if it’s huge.
	•	Concurrent Editing: Real-time multi-user editing (like Google Docs style) is not in scope initially. However, if two editors open the same graph simultaneously, last save wins could cause overwrite conflicts. We might put a simple lock or warning: e.g., when an editor opens, mark the graph as “locked for editing by X” or just hope it’s rare. This is a known limitation for MVP. Future improvement could include WebSocket collaboration, but that’s complex.
	•	Testing for Performance: We will test with synthetic large graphs (maybe generate 200 nodes with random edges) to see that the app remains usable. Also test on different browsers and devices (including a mid-range laptop and a tablet perhaps) to ensure performance is acceptable.

8. Accessibility (WCAG 2.2 AA Compliance)

Accessibility is a first-class consideration to allow users of all abilities to benefit from the tool:
	•	Visual Contrast: All text and important graphical indicators will have sufficient contrast (at least 4.5:1 contrast ratio for normal text as per WCAG AA). We will test themes with a color contrast tool. For example, ensuring that the green/red status icons on course nodes are distinguishable not just by color but also by shape (a checkmark vs X) and have contrast with the background.
	•	Keyboard Navigation: All interactive controls (buttons, menus, dialogs) are reachable via Tab/Shift-Tab and operable with Enter/Space or arrow keys as appropriate. The graph canvas itself is trickier: We will implement keyboard support such as:
	•	Arrow keys to move selection between connected nodes (or some structured traversal).
	•	Tab key might cycle through nodes sequentially (perhaps in the order they appear in the DOM or some logical order like alphabetical by course code).
	•	When a node is focused, keyboard shortcuts can trigger actions (e.g., Del to delete, Ctrl+C/Ctrl+V for copy-paste if we allow that, etc.).
	•	There will be a visible focus outline on the currently focused element (could be a glowing outline on a node if that node is focused).
	•	Screen Reader support: We will add appropriate ARIA labels or off-screen text for elements that aren’t standard form controls. For instance, the canvas could be given a role=“application” or “graphics-document” and we might provide a textual summary of the graph (like “Graph with 10 courses, 15 prerequisite connections. Use arrow keys to navigate courses. Selected course: CS101, prerequisites: MATH100 and ENG200” etc.). This is an area that will require testing with screen readers to get right.
	•	Focus Management: When modals open (like an edit course dialog), focus will be trapped inside the modal and return to the triggering element when closed. Also, a “Skip to content” link at page top can allow keyboard users to jump straight to the graph, bypassing navigation.
	•	Touch Targets: As mentioned, interactive elements like buttons will meet the WCAG 2.5.8 target size. Specifically, no button or clickable icon will be smaller than 24px by 24px CSS in the layout ￼, to accommodate those with limited dexterity and touch usage ￼. We’ll also ensure adequate spacing between interactive elements so they’re not pressed accidentally.
	•	No Critical Info in Tooltips Only: Any information shown on hover (like maybe the full course title if we only show code on the node) will also be accessible via focus or a persistent option. We won’t hide essential info solely in a hover tooltip.
	•	Testing: We will test the application with accessibility evaluation tools (like axe-core automated tests) and manually with screen readers (NVDA/JAWS for Windows, VoiceOver for Mac) and keyboard-only usage. We will try to meet WCAG 2.2 level AA as targeted, which covers most common accessibility needs.

9. Privacy

From a privacy perspective, we minimize data collection and give users control:
	•	Local Processing: As stated, the app does as much processing on the client as possible. Importing an Excel file, for example, can be done in the browser; no need to send the raw file to the server until the user chooses to save the parsed data. This means if someone is just exploring what the graph looks like from a file, they don’t even have to upload it to our servers – the visualization could be done purely in their browser (with an option to then save it).
	•	PDF Processing: Because PDF ingestion might involve sending data out for AI analysis, we will clearly inform users. Possibly the UI has an option: “Use local OCR (slower, stays on device)” vs “Use cloud AI (faster, but data is sent to server/provider)”. Some users or institutions might forbid uploading course data to third-party services, so we must respect that. We can partner with the user by maybe allowing them to supply their own API key for an OCR service if they prefer to maintain control – or just stick with Tesseract local by default.
	•	Stored Personal Data: We keep very little personal info – basically just user account info. The graphs themselves don’t contain personal data about individuals; it’s all course information (which is public in catalogs) and a user’s own planning status. If a user adds notes like “I struggled with this course” that’s personal but it’s in their private account unless they share it.
	•	Encryption: We ensure the database or storage is encrypted (most managed services do it by default). If we store files (maybe if we allow PDF upload, that PDF might be stored on a storage bucket temporarily), we will also want that encrypted. We may auto-delete source files after processing to not keep them around.
	•	Retention and Deletion: Provide a way for a user to delete their account and data, to comply with regulations like GDPR’s right to erasure. When an account is deleted, we remove all personal info. We might anonymize graphs (since those could be useful for aggregate stats, but out of caution probably just delete everything).
	•	Cookies and Tracking: We won’t use third-party trackers without consent. If any analytics is included, we’ll mention it. No advertising components obviously.

10. Internationalization (i18n)

Multi-language support is built-in from the start:
	•	Languages: Initially English (EN) and Hebrew (HE) as requested. All UI strings are translatable via a locale file or i18n library (like react-i18next or FormatJS). We’ll ensure text direction is adjusted for Hebrew (RTL).
	•	RTL Support: Hebrew being right-to-left means the layout of certain UI elements might need flipping (e.g., sidebars might appear on right instead of left, text alignment changes to right). We will use CSS direction property and maybe conditional classnames for RTL-specific adjustments. Also, for graph layout, when in RTL mode, we might want the graph to layout Right-to-Left (so prerequisites maybe flow from right side to left side if that is more intuitive in Hebrew). ELK might support an orientation or we can mirror the coordinates after layout (e.g., if in RTL, we can take the x positions as relative to a container width and invert them).
	•	Date/Number Formats: If we display any dates (like project creation date) or numbers (maybe credit counts), those will format according to locale (e.g., 1,234.56 vs 1.234,56 style, etc., using Intl APIs).
	•	Language Toggle: Provide an easy way in UI to switch language, and remember the preference (maybe in user profile or local storage).
	•	Content Translation: The course data itself likely stays in its source language (we’re not translating course names or descriptions). But any instructions, button texts, error messages should translate.
	•	Hebrew Testing: We will test that UI still looks good when translated (Hebrew text tends to be longer for some phrases, and the RTL alignment doesn’t break layout). Also ensure that the Mermaid export or others – we might want to see if Mermaid supports Hebrew text labels (it should, as it’s Unicode; just ensure proper escaping and direction in SVG).

11. Deployment

Deployment considerations ensure the app runs smoothly in production:
	•	Hosting: The frontend is deployed on Vercel as a static site (for instance, a Next.js or plain React app build output). The backend is a set of serverless functions on Vercel (we could use Next.js API routes or the newer Vercel Function spec). This means each API endpoint is effectively a separate function (though they can share code via common files).
	•	Database: We use a cloud Postgres service (like Neon or Supabase). Neon in particular is great for Vercel due to serverless driver support ￼. We will store the DB connection string as an environment variable on Vercel. If needed, we might use connection pooling via something like PgBouncer or just rely on Neon’s pooling.
	•	CI/CD: We will set up continuous integration such that on git pushes, tests run. Only if tests pass and code is linted do we deploy to an environment (maybe a staging environment for QA then production). Vercel can deploy preview builds for each branch which is useful for testing feature branches.
	•	Environment Configuration: Use different configs for dev vs prod (like dev might use a local SQLite or Postgres, prod uses Neon). Secrets (OAuth client secrets, JWT secret, etc.) are stored in Vercel’s secure environment store, not in code.
	•	Scalability: The serverless approach means if 1000 users suddenly come, Vercel will scale out functions as needed (within limits, but those limits are high). Neon can autoscale the database read replicas and such. We do have to be mindful of any cold start time in functions – Node functions on Vercel are quite fast to start, but heavy initialization (like loading a big OCR model) should be avoided in the request path; maybe pre-initialize or use lazy loading.
	•	Monitoring & Logging: We will use whatever Vercel provides for logs, and possibly integrate Sentry or a similar service for catching exceptions in both frontend and backend. This helps quickly identify issues in production. We’ll also monitor performance metrics (Vercel Analytics or manually instrumented ones).
	•	Compliance / Data Residency: If needed by universities, we might allow choosing region for deployment (Vercel allows picking regions for functions, and Neon offers multi-region). For now, we assume default.

12. Testing

Quality assurance is achieved through multiple levels of testing:
	•	Unit Tests: Key pure functions or modules will be unit tested. For example:
	•	The prerequisite expression parser will have extensive tests for various expressions (valid cases, invalid cases, edge cases with parentheses, etc.).
	•	The expression evaluator will be tested with different sets of completed courses to ensure it correctly gates course availability.
	•	The Excel import parser/validator should be tested with sample input files (we can automate this by having some CSV strings in tests or using a library that can read from a buffer).
	•	Utility functions like cycle detection in the graph.
	•	Security utilities like permission checker functions.
	•	Integration Tests: We can spin up a test database (perhaps using SQLite in memory or a test schema) and run tests against the API endpoints. For example:
	•	Create a test user, authenticate, create a project, import a small graph, then fetch the graph and verify the data is consistent.
	•	Test that a viewer cannot edit by calling an edit endpoint and expecting 403.
	•	Test share link flows by simulating the token access.
	•	If we have any external API calls (OCR, etc.), we might mock them in tests.
	•	End-to-End (E2E) Tests: Using a tool like Playwright or Cypress, we will simulate a user in a browser:
	•	E.g., open the app, log in, go to import page, upload a sample CSV, see that the graph renders with correct nodes.
	•	Click around the graph, add a node, undo it, redo it, and verify visually or via DOM that it reappeared.
	•	Try the share link: one test could generate a share link and then use a new browser context (no auth) to open it and verify that the graph loads in view mode.
	•	These tests help catch any breaking changes in the UI or integration issues between front and back.
	•	Performance Tests: We might include a test where we generate a large graph (maybe not 200 nodes, but say 100) and measure that operations complete under some threshold. This could be part of integration tests (not every commit, but maybe periodically).
	•	Accessibility Tests: Integrate axe-core in automated tests to catch basic accessibility issues in UI components as they are developed. Also manual testing as described.
	•	Beta Testing: Possibly have a pilot with a small group (maybe the requestor or some students) to try it out on real data and get feedback, which might reveal bugs or UX issues not caught by formal tests.

By maintaining this test suite, we ensure regressions are caught early and the application remains robust as new features (like the PDF parsing in Phase 2) are added.

Data Model Details

(This section summarizes the data model, partly covered earlier, but provides a reference schema for developers.)
	•	User: Represents an account.
	•	Fields: id (PK), email (unique), password_hash (if using email/pw), auth_provider (enum: local, google, etc.), display_name, locale (e.g., ‘en’ or ‘he’ for language preference), created_at, updated_at.
	•	Logic: Basic registration and login. Might also have a verified flag if we require email verification.
	•	Project: A collection of graphs, owned by a user.
	•	Fields: id (PK), owner_id (FK to User), name, description, created_at, updated_at.
	•	A user can have many projects; a project has one owner. The owner also appears in Membership.
	•	Membership: Many-to-many link between users and projects, with a role.
	•	Fields: user_id, project_id, role (varchar or small enum: ‘viewer’, ‘editor’, ‘owner’).
	•	Composite PK on (user_id, project_id). Alternatively, an id and unique index.
	•	Only one owner per project typically. Editors and viewers as needed. Owner role in membership basically duplicates project.owner_id but it’s useful for queries or if we ever allow multiple owners.
	•	Graph: A specific prerequisite graph.
	•	Fields: id (PK), project_id (FK to Project), name (or we might use project for naming and have one graph per project? But seems multiple graphs per project is allowed), layout_prefs (JSON storing e.g., last layout direction used, etc.), theme (maybe a JSON or theme name), version (an integer or separate version table if we do versioning), created_at, updated_at.
	•	If only one graph per project was intended, we could merge Graph into Project, but the text implies multiple graphs (like list graphs in a project).
	•	CourseNode: Represents a course (node in graph).
	•	Fields: id (PK), graph_id (FK), course_id (course code, e.g. “MATH101”), title, credits (number, can be float or int), department, level, term, status (enum: completed, in-progress, planned, not-taken, failed), badges (JSON or text array), notes (text, for any user notes).
	•	We will index graph_id and perhaps course_id within graph for quick lookup. course_id could be unique per graph (to ensure no duplicates).
	•	This table will have one row per course in the graph.
	•	Edge: Represents a prerequisite edge from one course to another.
	•	Fields: id (PK), graph_id (FK), source_id (FK to CourseNode), target_id (FK to CourseNode), label (text), notes (text), grouping_id (an identifier to group edges).
	•	We ensure at app level that no edge creates a cycle.
	•	grouping_id could be an integer or UUID. For example, all edges that belong to the same AND group might share a grouping_id. But actually, if it’s AND group, all those are required together… grouping might rather denote OR groups: edges with same grouping_id mean “any of these can satisfy”, whereas edges without grouping (or unique grouping per edge) mean all are required. We need to define that clearly:
	•	Possibly: if a course has multiple prerequisite sets (OR logic), each set gets a grouping_id, and within a set all edges are AND.
	•	Example: (A AND B) OR C for target X. We could assign grouping_id=1 for A->X and B->X (meaning those two together form one option), and grouping_id=2 for C->X (meaning another option).
	•	If a course just has A AND B required (no OR), we could either give them a grouping_id both the same or use a null to indicate they’re just all required. But giving them a grouping (like grouping_id = some value for all required edges) doesn’t differentiate from OR, except we’d then need another flag to say if grouping means AND or OR. Perhaps simpler: by default, all incoming edges are AND, and we introduce dummy node or an attribute for OR. However, managing this at data level might complicate. We might stick to using the expression in PrereqExpression as the source of truth, and edges are more for visualization (with some flags perhaps).
	•	In any case, the table supports grouping_id which we can use as we see fit to implement the above logic.
	•	We might also have an index on (graph_id, target_id) because we often fetch all edges for a course to compute requirements.
	•	PrereqExpression: (optional table) One row per course in graph that has a complex prereq.
	•	Fields: graph_id, course_id (or course node id), expression (text), normalized_ast (JSON, nullable), validation_state (e.g., “valid” or “error: message”).
	•	We could also encode this info as part of CourseNode, but having a separate table might allow expressions for courses not currently in graph (which shouldn’t happen) or storing history. But we can combine it into CourseNode as fields if we want to reduce complexity. However, since the spec explicitly listed it, we’ll keep it separate, possibly for easier updates separate from other course fields.
	•	ShareLink: Represents a shareable link token.
	•	Fields: id (PK) – though we might not need a numeric ID if token is unique, but good to have, graph_id (FK), capability (viewer/editor), token (unique string, maybe use UUID or nanoid), expires_at (datetime, nullable for no expiry), created_at.
	•	We will index by token to lookup quickly.
	•	We should also perhaps store who created it (user_id) for audit, but not strictly necessary.

These models correspond to our earlier descriptions. In code, each might be an ORM model or a table creation migration.

API Endpoints

The application exposes a RESTful API for all major operations. Below is an overview of the initial API surface, including endpoints, methods, and brief descriptions of their functionality:
	•	Authentication (tentative, not fully detailed in text but likely):
	•	POST /api/auth/register – Register a new user (with email & password).
	•	POST /api/auth/login – Log in with email/password.
	•	GET /api/auth/oauth_redirect – (If using OAuth, handle callbacks).
	•	POST /api/auth/logout – Log out the current session.
	•	These would manage the authentication flows. Responses would set cookies or return tokens accordingly.
	•	Project and Membership Management:
	•	POST /api/projects – Create a new project.
	•	Input: JSON with project name, description.
	•	Auth: User must be logged in (any user can create project).
	•	Behavior: Creates project with user as owner (and membership role owner), returns project data.
	•	GET /api/projects/:id – Retrieve project details.
	•	Auth: Must be a member (viewer or higher) of project.
	•	Returns: project info including maybe membership list if owner or editor.
	•	POST /api/projects/:id/invite – Invite a user to the project.
	•	Input: JSON with email and role.
	•	Auth: Must be owner of project (maybe editors can invite as editors or viewers depending on policy, but likely only owner).
	•	Behavior: Creates a membership for that email. If user exists, they get added and maybe notified. If not, could create a pending invite (for simplicity, we might just directly create an account with a random password and send an invite link to set password – or require the user to register).
	•	Note: Might send an email out-of-band; the API itself just manages the data.
	•	DELETE /api/projects/:id – Delete a project.
	•	Auth: owner only.
	•	Behavior: Marks project as deleted (we might soft-delete in DB, but from API perspective it’s gone).
	•	We may not implement delete in MVP to avoid accidental loss, but eventually yes.
	•	Possibly PUT /api/projects/:id to edit name/description (owner/editors maybe).
	•	Graphs:
	•	GET /api/projects/:id/graphs – List graphs in a project.
	•	Auth: member of project.
	•	Returns: an array of graphs (id, name, etc. perhaps plus created time).
	•	POST /api/projects/:id/graphs – Create a new graph in the project.
	•	Input: JSON, possibly initial graph data or an empty graph with a name.
	•	Auth: editor or owner in project.
	•	Behavior: Creates a graph record (and maybe some initial content if provided). Often this might be called after an import to create a populated graph.
	•	GET /api/graphs/:id – Get full graph data.
	•	Auth: must have access to the project.
	•	Returns: JSON including nodes, edges, and expressions for that graph, as well as maybe layout prefs. This is used to load the graph editor.
	•	PUT /api/graphs/:id – Update a graph.
	•	Input: JSON of changes (this could be full graph or partial. Possibly we send the whole node/edge list each save, or we have separate endpoints to add node, add edge, etc. For simplicity, maybe send the whole graph state to replace).
	•	Auth: editor or owner.
	•	Behavior: Writes changes to DB. Could do fine-grained updates (diffs) but easier is just replace all nodes and edges matching the client state (with proper transaction).
	•	We have to handle concurrent edits carefully if doing full replace (we might use a version number to detect overwrites).
	•	DELETE /api/graphs/:id – Delete a graph.
	•	Auth: owner or editor (probably owner).
	•	Behavior: removes graph and all child records.
	•	Import/Export:
	•	POST /api/import/excel – Handle an Excel/CSV file upload for import.
	•	Input: The file (multipart form-data or maybe base64 JSON). Or perhaps we do not need an API if we parse client-side – but if we want server to do it (maybe for consistency or large file), we have this.
	•	Auth: user must be logged in (we might not tie to project yet until they choose to save).
	•	Behavior: The server parses the file, does validation, and returns the parsed data structure (courses and their fields and any errors). Possibly it could directly create a graph if project id is provided.
	•	Alternatively, we skip this API in MVP by doing client-side parse and then just call the create graph API with JSON.
	•	POST /api/import/pdf – Start a PDF ingestion job.
	•	Input: PDF file upload, and maybe project/graph info or we create a new graph from it.
	•	Auth: user logged in.
	•	Behavior: This might respond immediately with a job ID and initial status (e.g., “processing”). We then have perhaps:
	•	GET /api/import/pdf/:jobid to poll status and results.
	•	Once done, user can confirm and finalize import (maybe POST /api/import/pdf/:jobid/confirm to actually save it).
	•	This is phase 2; in MVP this won’t be active.
	•	Exports (which might not need separate API if done client-side, but for things like image maybe):
	•	POST /api/graphs/:id/export – Could be a unified endpoint where the client says format = mermaid|svg|png|json|excel.
	•	If format=mermaid, server could generate the mermaid text and return as text/plain download.
	•	If format=json, just returns the graph JSON (though GET /graphs/:id already does that, so maybe not needed).
	•	If format=svg or png, server might need to render the image. That’s tricky because React Flow rendering on server is not trivial. Alternatively, the client already has the rendered graph and we can use client-side export (e.g., client generates an SVG via the DOM). So we might not implement an API for images; the client can directly prompt a download.
	•	If format=excel, server can generate an Excel file using a library (like populate a template xlsx). This could be done client-side too (SheetJS can create xlsx in browser). But large excel maybe better on server. Up to implementation.
	•	For simplicity, we might not implement this as a single endpoint; instead provide direct links or client-side generation for most. Only Mermaid and Excel might benefit from server to avoid bundling those generators in front-end.
	•	Share:
	•	GET /api/share/:token – Access a shared graph via token.
	•	Auth: No standard auth required; the token in URL is the auth.
	•	Behavior: The server checks the ShareLink with that token. If found and not expired:
	•	It could either redirect to a front-end route that handles share (if using Next.js, maybe this is handled by server side rendering page). But likely easier: the front-end will hit this endpoint via fetch when it sees a share token.
	•	The server can set a special cookie or return a one-time JWT as mentioned, which grants limited access.
	•	Or the server simply returns the graph data directly if it’s a GET and maybe include a flag in the data that says “readonly” or “canEdit” depending on capability.
	•	We will ensure the token cannot be used to escalate privileges beyond that single graph.

All responses will typically be JSON (except file downloads). Errors will be conveyed with appropriate HTTP status codes and a JSON error message.

The above endpoints are initial; as features expand (like editing course details might be separate route or not, depending on how our client uses the PUT graph or separate smaller mutations).

PDF Ingestion Pipeline (Phase 2 Details)

(This section outlines how the PDF parsing will be implemented when we reach Phase 2, complementing the earlier description in import.)
	1.	Upload & OCR: When a PDF file is uploaded for import:
	•	If the PDF has an accessible text layer (some PDFs are not scanned images but have actual text), we can extract text directly (using a library like PDF.js or a PDF parsing library in Node). If text is accessible, skip OCR to save time.
	•	If no text layer (scanned images), we proceed with OCR. Using Tesseract.js in the browser is one way: we might break the PDF into images per page (using PDF.js to render pages to canvas, then feed to Tesseract). This could all happen client-side, meaning no file leaves the user’s machine (good for privacy). The downside is performance – Tesseract in pure JS can be slow for many pages. Alternatively, if the user consents to using a cloud service, we send the file (or images) to the server which then calls e.g., Google Vision API. Google Vision can return text for the whole page with coordinates of words, which might help in structured extraction.
	•	For MVP/Phase1, we likely skip PDF entirely. In Phase 2, implementing at least Tesseract as a first step (client-side) is likely, with a fallback where the user can tick “use cloud OCR for better accuracy”.
	2.	Text Processing: Once raw text is obtained (which might be a continuous string or separated by pages):
	•	We will implement parsing rules. Perhaps we require that the PDF be somewhat structured, e.g., each course entry starts with a course code and title on one line, followed by details like credits and prerequisites in subsequent text. We’ll attempt to detect those:
	•	Identify lines that look like a course header. For example, a regex capturing something like ^([A-Z]{2,5}\s?\d{2,4})\s+(.+?)\s+(\d+ (credits|pts)) might capture course code, name, and credits.
	•	If found, we create a new course entry. Then subsequent lines until the next course code might contain description or prerequisites. We specifically search those lines for keywords like “Prerequisite” or “Prereq” or variations.
	•	If found, extract the text after “Prerequisite:”. Sometimes, multiple prerequisite sentences exist. Also note “Prerequisite(s):” could list multiple, and some catalogs also list “Corequisite” or other info – we should perhaps isolate our scope to prerequisites only.
	•	Use a list of common department codes (if known) to identify course codes in prerequisite text. For example, find all tokens like “MATH 101” or “101” if preceded by context like “Math”. Some catalogs might abbreviate if within same department.
	•	After extraction, for each prerequisite text string, we feed it into our AI-assisted parser:
	•	We can attempt a deterministic parse first: for example, if text is structured like “Prerequisite: MATH 101 and 102, or PHYS 100.” We replace “and” with AND, “or” with OR, remove punctuation, ensure course codes are consistent format, etc., and see if our expression grammar can parse it.
	•	If the text is complicated (e.g., full sentences or contains conditions like “with a grade of B or higher”), an AI (like GPT) could be prompted to output the simplified logic. But using AI means cost and also potential error, so maybe as a fallback if our simpler methods fail.
	•	The result for each course is a structured entry (id, name, credits, and a prerequisite expression string).
	•	We then proceed as in Excel import: present the results for user confirmation.
	3.	User Review UI: The user sees a list of courses extracted, maybe in a table form or side-by-side with original text:
	•	If something is wrong (e.g., a course missing or a prerequisite expression looks wrong), the user can edit that entry directly in the interface.
	•	We might highlight unrecognized course codes and ask the user to fix or confirm them (maybe OCR misread “I” vs “1” or “O” vs “0” which is common).
	•	If the OCR text was poor, user may have to correct a lot, which is unfortunate, but at least they didn’t type everything from scratch.
	•	If everything looks good, user clicks “Confirm Import” or “Save Graph”.
	4.	Save to Graph: The confirmed data is then either sent to the server to create a new graph, or applied to an existing graph if we allowed merging. Most likely, it creates a new graph in a chosen project.
	5.	Future enhancements: Possibly train/customize a model specifically for parsing prerequisites if we have enough samples – but that’s beyond initial scope. Also, eventually, we could attempt to parse not just prerequisites but other course relationships or requirements like degree requirements (but that’s outside current scope which is just prerequisites).

Note: PDF parsing is inherently fuzzy; so we treat any result with caution and always involve user confirmation. This is why it’s Phase 2 – to ensure MVP works with structured input first.

Editor User Interface Highlights

(Summarizing some points already made with focus on UI/UX specifics for developers to implement.)

The graph editor UI is the heart of the user experience. Some notable design and interaction elements:
	•	Palette/Toolbar: There will be a side panel or top toolbar with tools:
	•	Add Course (could be a button that when clicked, allows placing a new node on canvas).
	•	Add Group (if using groups).
	•	Add Note (text label).
	•	Perhaps a search bar to find courses by name/code if the graph is big.
	•	Undo, Redo buttons.
	•	Zoom controls (+, -, fit to screen).
	•	Layout toggle (a dropdown or button group: LR vs TD, and ELK vs Dagre).
	•	Theme switcher.
	•	Possibly a filter (like highlight prerequisites of a selected course, etc.).
	•	Node Interaction: Clicking a course node likely opens a detail view (maybe a side drawer) where one can edit the course’s properties and see its prerequisites:
	•	In that view, we can show the prerequisite expression (which might be not directly editable text if they prefer visual, but we can allow editing text or using a small form to add conditions).
	•	Also allow changing status (Completed, etc.) via a dropdown or toggle in this detail view or directly on node (like right-click context menu with “Mark as completed”).
	•	Edge Interaction: Clicking an edge might show any notes or allow deleting the edge. Perhaps prerequisites that require a minimum grade or concurrency could be annotated; however, that might be too detailed for now.
	•	Dragging and Connecting: Ensure the React Flow configuration allows users to drag from a node’s handle to another. Use proper connection validation (React Flow lets you prevent connecting if certain conditions aren’t met – e.g., disallow connecting a node to itself or creating duplicate edges).
	•	Grouping Implementation: If using group nodes, the UI might let you select multiple nodes and then click “Group” to wrap them. Or if automatically grouping by a field (like department), we might generate group containers behind the scenes. Collapsing a group could be done via a small collapse/expand icon on the group node. Collapsing would hide member nodes (maybe retain just the group node with a count of items).
	•	Progress Highlighting: We’ll use color and opacity to signify course availability:
	•	For example, if a course is not yet takeable, its node could be semi-transparent or greyed out. Same for edges leading out of incomplete prereqs.
	•	Completed courses might be colored normally or with a green border.
	•	The legend or help tooltip should explain these cues.
	•	Mermaid Editor Panel: If included, possibly a toggle to show a split view: diagram on left, code on right. The code panel would contain the Mermaid text. If user edits it and clicks “apply”, we would attempt to parse it and update the graph (which is tricky if they do big changes – could just regenerate graph from scratch).
	•	Responsive Design: The app should be usable on at least tablets if not phones (though large graph editing on a phone is not ideal). We’ll ensure the layout is responsive: sidebars can collapse, the graph can take full screen on small devices. Buttons should not be too small (which ties back to accessibility).
	•	Internationalization in UI: E.g., when switching to Hebrew, the palette might shift to right side if that’s more natural in RTL, and text alignments flip.
	•	Error Handling in UI: If something goes wrong (e.g., saving fails due to network), show a message and perhaps keep changes locally to retry. If import has errors, highlight them clearly next to the fields.
	•	Internationalization of UI terms: We’ll have translations for all UI labels. For Hebrew, also ensure fonts used support Hebrew characters.

All these UI behaviors will be implemented in the React front-end. React Flow provides a lot of base functionality, but we will extend it with custom components (e.g., custom node renderer so we can display status icons, etc.). We should refer to React Flow’s docs/examples for implementing custom nodes and grouping. (React Flow has an example for nested nodes/groups, and we might leverage that).

Security & Compliance Summary

(This recaps some security with possibly compliance notes, partially covered earlier.)
	•	The application will enforce modern security best practices, including content security policy (CSP) headers to prevent XSS, using HTTPS and HSTS headers to prevent man-in-the-middle attacks, and validating all inputs to the server.
	•	We will maintain an audit log (even if just in logs) of critical actions like permission changes or data deletion, which can be reviewed by administrators if needed.
	•	If used in an academic environment, we should ensure compliance with any relevant policies (for example, if integrated in a university system, possibly need to go through security review; since we aren’t dealing with highly sensitive data, the main concern is account safety).
	•	The app will have a terms of service and privacy policy that users must agree to, explaining data usage (especially important if we allow AI parsing of their PDFs – we should clarify what happens to that data).

Open Questions

Despite the detailed plan, some decisions remain open and should be resolved before implementation:
	1.	Excel Schema vs AND/OR Representation: Initially, the idea was to have a simple prereq_course_id_list column for prerequisites, but we moved to a full prereq_expression to support AND/OR. We should confirm if supporting both is needed. Perhaps we allow prereq_course_id_list as an optional convenience (if present and prereq_expression is empty, we interpret the list as an AND of those courses). However, maintaining two ways can cause confusion. It might be acceptable to stick with prereq_expression only, given it can express a simple list anyway (just use AND). Decision needed: Do we include a separate simple list column, or just one expression column? (Recommendation: one expression column for simplicity, with “NONE” or blank to indicate no prereq.)
	2.	Credits/Points Field: We need to confirm how to handle course credit values. Are these integers typically? (Many US courses use integers, but some systems might have half-credits or credit points that are decimal). We should also ask if we need to implement any weighting beyond simple sum/average. For instance, some might want to calculate GPA weighted by credits; but GPA requires grades which we do not capture. Possibly “credit-weighted average” was referring to average grade weighted by credits, but since we don’t store grades, maybe it means average credits per semester or something. Decision needed: Clarify the interpretation of “credit-weighted averages” in requirements and whether to incorporate grade tracking.
	3.	Term Representation: The data model allows a term field (e.g., Fall/Spring). Should this be free-form or restrict to a set list? Perhaps make it configurable per project (like a list of term names). Default could be [“Year1-Sem1”, “Year1-Sem2”, “Year2-Sem1”, …] or simply “Sem1, Sem2, Summer”. Decision needed: Provide a default term list (like 1,2,Summer) and allow user to add/edit terms for grouping.
	4.	OCR/AI Providers: When implementing PDF parsing, decide which OCR and NLP services to use. If keeping everything open-source and local, Tesseract.js is the way (with potential quality trade-offs). If using cloud, need to ensure it’s optional and perhaps allow user to choose provider if we integrate multiple. Also cost considerations (maybe limit pages or require the user’s own API key for heavy usage to avoid our costs). Decision needed: Which OCR (Tesseract vs cloud) and AI service (OpenAI vs local model) to use for Phase 2, and how to offer it (likely decide closer to phase 2 with user input).
	5.	Mermaid Export Expectations: Clarify how the exported Mermaid should look, especially regarding groups and styling. Do we want to represent groups as Mermaid subgraphs? Should we include icons or just text? Also, if the user has a dark theme in our app, do we attempt to reflect styling in Mermaid (Mermaid has some theming ability but limited)? Likely we output a clean default style. Decision needed: Agree on a format for Mermaid export (with example) and any specific requirements the user has for that.
	6.	Accessibility Testing: Confirm the target of WCAG 2.2 AA including the new Success Criterion 2.5.8 (target size). The plan is to meet it, but any specific assistive tech (screen readers) that the stakeholders use should be tested. For example, if visually impaired users at the university use JAWS, we ensure compatibility. Decision/Action: Identify key AT tools to test with (NVDA, VoiceOver, etc.) and possibly get feedback from an accessibility expert or user.

These open questions highlight areas for further clarification with the project stakeholders or within the team before those features are implemented. They do not block the core development of MVP (except possibly the first two which affect data schema), but they are important for polishing the product to fit user expectations.

Development Roadmap

The implementation will be tackled in phases, delivering a usable product early and then iterating to add advanced features:
	•	MVP (Excel-first ingestion & basic editor) – Focus on core functionality and robustness.
	1.	Prerequisite Expression Parser & Evaluator: Implement the grammar and parser for prerequisite logic, along with functions to validate and evaluate prerequisites given completed courses. Test thoroughly with sample expressions.
	2.	Excel/CSV Import: Create the Excel template. Implement parsing (probably client-side using a library) and validation of the spreadsheet. Develop the error reporting for import issues. Also implement server endpoint to accept the data and create a graph.
	3.	Graph Data Model & Persistence: Set up the database with all necessary tables (user, project, membership, graph, course_node, edge, prereq_expression, share_link). Implement the ORMs or SQL queries for creating and retrieving graphs.
	4.	React Flow Editor Basic Setup: Integrate React Flow into the app. Define the node types (course node with a custom JSX that can show title, status icon, etc.). Define how edges look (maybe use default straight edges or orthogonal edges). Add ability to add/delete nodes and edges through the UI.
	5.	Layout Integration: Add ELK.js and Dagre. After any data change or on load, call the layout function to get node coordinates, then update React Flow. Provide a toggle for direction and layout engine. Ensure that manual dragging of nodes is enabled and doesn’t immediately get overridden by layout (maybe disable auto-layout if user moves things manually until they click re-layout).
	6.	Undo/Redo & Autosave: Implement a command history for the editor. Possibly use a library or just keep an array of past states (limited size to avoid memory issues). Bind Ctrl+Z / Ctrl+Y (or Cmd on Mac) to undo/redo. Implement autosave: maybe use a debounced function to send updates 5 seconds after last change. Also have a Save button for manual trigger.
	7.	Basic UI & Themes: Build out the surrounding UI (project selection screen, graph list, etc.). Add theme support (maybe just light/dark for MVP). Ensure the UI can switch to Hebrew (even if translations come later, but at least test RTL layout switching).
	8.	Export Features: Implement JSON export (trivial, just offer download of current graph JSON). Implement Mermaid export generation. Possibly leave image export for later (user can screenshot as interim).
	9.	Accounts & Sharing (MVP subset): At least implement login and project membership. Possibly skip OAuth for initial release if time, but have email/pw working. Implement share links for view-only as that’s simpler (edit links can come next).
	10.	Testing & Polish: Before MVP release, test the whole flow: import a real CSV, adjust graph, mark statuses, export, share link. Fix any bugs or UI issues found.
	•	Phase 1 (Rich Editing & Collaboration features) – Enhance the user experience, editing capabilities, and sharing.
	1.	Advanced Grouping: Implement collapsible container nodes in the UI. Allow grouping by property via a menu (like “Group by Department” auto-creates groups). Enable manual grouping (select nodes -> Group). Ensure edges crossing group boundaries are handled (maybe rendered with different style).
	2.	Live Eligibility Highlighting: We already have status affecting color; here we refine it. Perhaps add a mode where hovering over a course highlights all courses that become available if that one is done, etc. Or show which prerequisites are missing when you click a course (e.g., in a side panel “To take this course, you need: Course A (done), Course B (not done)”). This involves traversal in the graph (which we can get from edges easily).
	3.	Performance Tuning: If any issues were found with large graphs, address them now. This could include virtualizing the nodes list if necessary, optimizing the layout step, etc.
	4.	Mermaid Sync Editing: If we decide to include an editable Mermaid panel, implement parsing of Mermaid text to update the graph. Caution here: since Mermaid is less expressive than our full model, we might restrict what can be done or just support adding/removing simple edges/nodes. This is a stretch goal for phase 1.
	5.	Real-time Collaboration (stretch if feasible): Possibly integrate something like Y.js or ShareDB for multi-user editing if there’s interest. But this might be beyond scope unless specifically needed. At minimum, maybe indicate if someone else has the graph open (could do via WebSocket to broadcast presence).
	6.	UI/UX improvements: Based on user feedback from MVP, tweak the interface. For instance, maybe implement a mini-map for the graph if it’s large, or allow printing the graph, etc.
	7.	Internationalization Full Support: Ensure Hebrew translation is completed and QAed. Possibly add another language if desired.
	8.	Accessibility Verification: Conduct an accessibility audit and fix any issues (like missing alt texts, keyboard traps, etc.) to ensure compliance.
	•	Phase 2 (PDF Ingestion & AI Integration) – Big feature: automated catalog parsing.
	1.	OCR Pipeline Implementation: As described, integrate Tesseract.js for client OCR or set up server OCR via an API. Test with several sample PDFs from resources/pdftesting (assuming a set of example catalogs). Optimize as needed (e.g., do one page at a time to not block too long).
	2.	AI Parsing Integration: Use a service or library to parse prerequisite sentences. This could involve calling an AI API. We need to do prompt engineering and testing to ensure it outputs something we can map to our grammar. Alternatively, try building a custom parser with NLP heuristics for the known patterns.
	3.	Review UI: Develop the interface for showing extracted courses and allowing edits. This likely will be a step-by-step wizard: Step 1 upload & OCR, Step 2 show extraction result in a table, Step 3 confirm to save.
	4.	Backend for PDF: If using external OCR or long tasks, set up a background job system. Perhaps utilize Vercel’s background function capability or an external job queue (Redis-based). We might also consider a microservice specifically for this heavy task if needed.
	5.	Merge with existing Graph (if needed): Perhaps allow importing a PDF into an existing project or updating an existing graph (e.g., a new catalog version). Ensure we handle duplicates or changed course codes gracefully (maybe new graph is simpler).
	6.	Testing with Real Data: Use actual university PDFs to test the pipeline. Fine-tune the parsing as needed.
	7.	Deployment and Load considerations: PDF parsing could be resource-intensive. We must ensure it doesn’t crash the server on large files. Possibly impose a limit (like max 50 pages at once, or break them). For too big files, warn the user to maybe split by department or year.
	8.	User Training & Documentation: By Phase 2, we might produce user-facing documentation (help guides) especially for the PDF import since it’s complex. Not a dev concern, but something to plan for.

Throughout all phases, we will keep refining based on user feedback and needs. By the end of Phase 2, we aim to have a comprehensive tool that can ingest data from multiple sources, allow rich interaction, and shareable outputs – all while maintaining accuracy and ease of use for planning academic journeys.

⸻

This concludes the technical documentation for the Course Catalog Prerequisite DAG application. The document covered the system’s purpose, architecture, data model, feature set, and implementation roadmap in detail. Developers should use this as a reference for building and maintaining the system, ensuring that all requirements are met and that the end product is robust, user-friendly, and secure.

Sources & References:
	•	React Flow documentation on integrating automatic layout (Dagre & ELK) ￼ – confirms approach for using external layout engines with React Flow.
	•	Mermaid official site – for understanding text-based diagram definitions ￼.
	•	Neon (Serverless Postgres) info ￼ – describes the benefit of using Neon for a serverless-ready Postgres database.
	•	W3C WCAG 2.2 guidelines ￼ – for ensuring UI target sizes meet accessibility standards (minimum 24×24 px for interactive controls).
	•	Tesseract.js project ￼ – illustrating that Tesseract can perform OCR in browser for text extraction from images/PDFs.