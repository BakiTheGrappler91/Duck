# 🦆 Duck - A Lightweight Git-Like Version Control CLI

**Duck** is a simple, educational version control system inspired by Git. It's built using Node.js and lets you initialize a repository, add files to a staging area, commit changes, and view commit history — all from the command line.

---

## 📦 Features

- `duck init` – Initializes a new `.duck` repository
- `duck add <file>` – Stages a file for commit
- `duck commit <message>` – Commits staged files with a message
- `duck log` – Displays the commit history
- `duck show <commitHash>` – Shows the diff of a given commit vs. its parent

---

## 🛠️ Built With

- **Node.js** – Runtime environment
- **Commander** – CLI interface
- **fs/promises** – File system handling
- **crypto** – SHA1 hashing
- **chalk** – Colored terminal output
- **diff** – Text diffing for commits

---
