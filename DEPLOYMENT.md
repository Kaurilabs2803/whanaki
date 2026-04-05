# Whānaki — Complete Beginner's Deployment Guide

**Goal:** Get the Whānaki application running on the internet at `https://whanaki.kaurilabs.kiwi`, and set up a system where pushing code to GitHub automatically updates the live website.

**Who this is for:** This guide assumes you have never deployed a web application before. We explain every concept, every button, and every command.

**Estimated time:** 1.5–2.5 hours for first-time setup.  
**Estimated cost:** ~$75–110 USD/month (DigitalOcean Droplet ~$48, Managed PostgreSQL ~$15, Managed Valkey ~$15).

---

## Table of Contents

1. [What We Are Building](#what-we-are-building)
2. [What You Need Before Starting](#what-you-need-before-starting)
3. [Part 0 — Create Your GitHub Repository](#part-0--create-your-github-repository)
4. [Part 1 — Set Up Authentication (Clerk)](#part-1--set-up-authentication-clerk)
4. [Part 2 — Set Up Billing (Stripe)](#part-2--set-up-billing-stripe)
5. [Part 3 — Create the Server (DigitalOcean)](#part-3--create-the-server-digitalocean)
6. [Part 4 — Create Managed Database & Valkey](#part-4--create-managed-database--valkey)
7. [Part 5 — Connect Your Domain Name](#part-5--connect-your-domain-name)
8. [Part 6 — Run the Automatic Server Setup](#part-6--run-the-automatic-server-setup)
9. [Part 7 — Configure the Application](#part-7--configure-the-application)
10. [Part 8 — Start the Application for the First Time](#part-8--start-the-application-for-the-first-time)
11. [Part 9 — Enable Push-to-Deploy (GitHub Actions)](#part-9--enable-push-to-deploy-github-actions)
12. [Part 10 — Verify Your Auto-Deploy Pipeline](#part-10--verify-your-auto-deploy-pipeline)
13. [Part 11 — Everyday Operations](#part-11--everyday-operations)
14. [Part 12 — Troubleshooting](#part-12--troubleshooting)
15. [Glossary](#glossary)
16. [Appendix: Ollama on the Same Droplet](#appendix-ollama-on-the-same-droplet)

---

## What We Are Building

When you are finished, you will have this architecture running on DigitalOcean in Sydney:

```
                         INTERNET
                            │
            ┌───────────────┴───────────────┐
            │                               │
    whanaki.kaurilabs.kiwi         api.whanaki.kaurilabs.kiwi
            │                               │
            └───────────────┬───────────────┘
                            │
                         Nginx
                     (Reverse Proxy)
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
       ┌─────────┐    ┌──────────┐    ┌──────────┐
       │Frontend │    │ Backend  │    │ Backend  │
       │Next.js  │    │Replica 1 │    │Replica 2 │
       └─────────┘    └────┬─────┘    └──────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   ┌──────────┐      ┌──────────┐       ┌──────────┐
   │PostgreSQL│      │  Valkey  │       │ RAGFlow  │
   │(Managed) │      │(Managed) │       │ + Elastic│
   └──────────┘      └──────────┘       └──────────┘
```

**In plain English:**
- A visitor types `whanaki.kaurilabs.kiwi` into their browser.
- **Nginx** (a traffic director) decides whether to show the website (Frontend) or send the request to the API (Backend).
- The **Frontend** is the visual website built with Next.js.
- The **Backend** is the engine built with Python/FastAPI. We run **two copies** (replicas) for reliability.
- **PostgreSQL** stores all permanent data (users, documents, chat history).
- **Valkey (Redis-compatible)** stores temporary data like rate-limit counters.
- **RAGFlow** (with Elasticsearch) handles AI document ingestion and vector search.

### The Magic Workflow We Are Setting Up

Once this guide is complete, your day-to-day life as a developer becomes incredibly simple:

1. You write code on your computer.
2. You commit and push it to the `main` branch on GitHub.
3. GitHub automatically runs tests.
4. If tests pass, GitHub automatically connects to your DigitalOcean server and deploys the new code.
5. The live website updates within 2–3 minutes.

**No manual FTP. No dragging files. Just `git push`.**

---

## What You Need Before Starting

You need **four accounts** and **one domain name**. Open them in browser tabs now.

| Requirement | Why You Need It | Sign Up Link |
|---|---|---|
| **GitHub Account** | Hosts your code and runs the deployment automation | https://github.com/join |
| **DigitalOcean Account** | Hosts the server, database, and cache 24/7 | https://cloud.digitalocean.com/registrations/new |
| **Clerk Account** | Handles user login, sign-up, and secure tokens | https://dashboard.clerk.com |
| **Stripe Account** | Handles subscriptions and billing | https://dashboard.stripe.com/register |
| **Domain Name** | `whanaki.kaurilabs.kiwi` — you must be able to edit its DNS records. | Any registrar (Cloudflare, GoDaddy, iwantmyname) |

> **Important:** You must be able to log into the control panel of your domain registrar to change DNS settings. If someone else bought the domain for you, ask them for access now.

### Tools on Your Computer

You need a terminal to run remote commands:
- **Windows 10/11:** Open **PowerShell**. SSH is built-in.
- **Mac:** Open **Terminal**. SSH is built-in.
- **Linux:** Open your terminal. SSH is built-in.

---

## Part 0 — Create Your GitHub Repository

Before you can deploy anything, you must have a GitHub repository that contains this code. The server setup script will download ("clone") the code from GitHub onto your DigitalOcean server, and the auto-deploy pipeline will watch this repository for new commits.

### Step 0.1: Create the Repository on GitHub

1. Go to https://github.com/new
2. **Repository name:** Enter `whanaki` (you can choose a different name, but make sure to use that name consistently in all commands below).
3. **Visibility:** Select **Public** for simplicity. *(If you choose Private, the automatic `curl` setup script will fail because it cannot access a private repo without authentication. In that case, you will need to manually copy the code to the server using `scp` instead.)*
4. **Do NOT check** "Add a README file", "Add .gitignore", or "Choose a license". This project already includes all of those files.
5. Click **"Create repository"**.

You will be taken to a page with instructions. Keep this browser tab open.

### Step 0.2: Push the Local Code to GitHub

> **Critical:** This project may be sitting inside a parent download folder (e.g. `whanaki-phase3-complete/whanaki/`). You must push from the **inner `whanaki` folder** — the one that directly contains `backend/`, `frontend/`, `infra/`, and `.github/workflows/`.
>
> Pushing from the wrong folder will create an extra nested folder on GitHub, which breaks the setup script and the auto-deploy pipeline.

Open your terminal on your local computer and run these commands **one by one**:

```bash
# Navigate to the INNER whanaki folder.
# If your folder structure looks like whanaki-phase3-complete/whanaki/,
# you MUST cd into the second whanaki folder:
cd "C:\Users\sampa\Downloads\Projects\Kauri Labs Limited\Kauri Labs Kiwi\Products\whanaki-phase3-complete\whanaki"

# (Mac/Linux users: adjust the path to wherever the inner whanaki folder is)

# Verify you are in the right place — you should see backend/, frontend/, infra/, etc.
ls

# Initialize git (skip this if the folder already has a .git folder)
git init

# Add all files
git add .

# Commit them
git commit -m "Initial commit"

# Rename the branch to main
git branch -M main

# Check if a remote already exists
git remote -v

# If you see NO output, add the new remote:
git remote add origin https://github.com/YOUR_USERNAME/whanaki.git

# If you see output pointing to the WRONG URL (e.g. it says YOUR_USERNAME literally),
# remove it first, then add the correct one:
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/whanaki.git

# Push the code to GitHub.
# If you previously pushed from the WRONG (parent) folder and now see a nested
# whanaki/ folder on GitHub, use --force to overwrite it with the correct structure:
git push -u origin main --force
```

**What this does:** It uploads every file in the Whānaki project (including the deployment scripts, Docker configs, and GitHub Actions workflows) to your GitHub account.

After running these commands, refresh your GitHub repository page in the browser. You should see all the files listed there, including `.github/workflows/deploy.yml`.

> **Common mistake:** If you see `error: remote origin already exists.`, it means this folder was already linked to a repository (possibly with a placeholder URL like `YOUR_USERNAME`). Always run `git remote -v` first. If the URL is wrong, run `git remote remove origin` before `git remote add origin`.

> **Another common mistake:** If `git push` says `Repository not found`, double-check three things:
> 1. You actually created the repository on GitHub first (Step 0.1).
> 2. You replaced `YOUR_USERNAME` with your real GitHub username in the URL.
> 3. The repository name in the URL exactly matches the name you created on GitHub.

---

## Part 1 — Set Up Authentication (Clerk)

Clerk is a service that handles user accounts so you don't have to build your own password system.

### Step 1.1: Create a Clerk Application

1. Go to https://dashboard.clerk.com and sign in.
2. Click **"Create application"**.
3. Name it `Whānaki`.
4. Under **"How will users sign in?"**, make sure **Email + Password** is enabled.
5. Click **Create application**.

### Step 1.2: Configure the URLs

After creation, Clerk needs to know where to send users after they log in.

1. In the left sidebar, click **"Configure"** → **"Paths"**.
2. Enter these values **exactly**:
   - **Sign-in URL:** `/sign-in`
   - **Sign-up URL:** `/sign-up`
   - **After sign-in URL:** `/dashboard`
   - **After sign-up URL:** `/onboarding`
3. Click **Save changes**.

### Step 1.3: Get Your API Keys

1. In the left sidebar, click **"API Keys"**.
2. You will see two keys. **Copy both into a temporary text file on your computer** (like Notepad). You will paste them into your server later.
   - `CLERK_PUBLISHABLE_KEY` (starts with `pk_`)
   - `CLERK_SECRET_KEY` (starts with `sk_`)

> **Leave the Clerk tab open.**

---

## Part 2 — Set Up Billing (Stripe)

Stripe processes credit cards and subscriptions.

### Step 2.1: Create Your Products

1. Go to https://dashboard.stripe.com and sign in.
2. In the top-left corner, toggle the switch to **"Test mode"**. This lets you practice without real money.
3. In the left sidebar, click **"Products"** → **"Add product"**.
4. Create three products one by one:

| Product Name | Price (NZD) | Billing Period |
|---|---|---|
| Whānaki Starter | $99.00 | Monthly |
| Whānaki Professional | $299.00 | Monthly |
| Whānaki Enterprise | $799.00 | Monthly |

For each product:
- Enter the name and price.
- Set **"Recurring"** to **Monthly**.
- Click **Save product**.
- After saving, you will see a **Price ID** (looks like `price_1Pxxxxx`). **Copy each Price ID into your text file**:
  - `STRIPE_PRICE_STARTER=price_...`
  - `STRIPE_PRICE_PROFESSIONAL=price_...`
  - `STRIPE_PRICE_ENTERPRISE=price_...`

### Step 2.2: Get Your Stripe Secret Key

1. In the Stripe dashboard left sidebar, click **"Developers"** → **"API keys"**.
2. Copy the **Secret key** (starts with `sk_test_` in test mode).
3. Save it: `STRIPE_SECRET_KEY=sk_test_...`

### Step 2.3: Create a Webhook Endpoint

A **webhook** is how Stripe tells your app when someone pays or cancels.

1. In the left sidebar, click **"Developers"** → **"Webhooks"**.
2. Click **"Add an endpoint"**.
3. Enter this URL exactly:
   ```
   https://api.whanaki.kaurilabs.kiwi/v1/billing/webhook
   ```
4. Click **"Select events"** and check these four boxes:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Click **"Add endpoint"**.
6. On the next screen, click **"Reveal"** next to **Signing secret**.
7. Copy the signing secret (starts with `whsec_`):
   `STRIPE_WEBHOOK_SECRET=whsec_...`

> **Leave the Stripe tab open.**

---

## Part 3 — Create the Server (DigitalOcean)

A **server** (also called a Virtual Private Server or VPS) is a computer that stays on 24/7 running your app. DigitalOcean calls their servers **Droplets**.

### Step 3.1: Create a DigitalOcean Account

If you haven't already, sign up at https://digitalocean.com and add a credit card.

### Step 3.2: Create a Droplet

1. Log in to the DigitalOcean dashboard.
2. Click the green **"Create"** button in the top-right, then select **"Droplets"**.
3. **Choose Region:** Select **Sydney (`syd1`)**.
4. **Choose an image:** Select **Ubuntu 22.04 (LTS) x64**.
5. **Choose Size:** For a starter production site, select:
   - **Basic** → **Regular SSD** → **$48/month** (2 vCPU, 4 GB RAM / 50 GB SSD)
   - *If you plan to run Ollama on the same droplet (see Appendix), upgrade to **$72/month** (2 vCPU, 8 GB RAM).*
6. **Choose Authentication Method:** Select **SSH Key**.
   - If you don't have an SSH key listed, click **"New SSH Key"**.
   - On your computer, open PowerShell (Windows) or Terminal (Mac/Linux).
   - Run:
     ```bash
     ssh-keygen -t ed25519 -C "whanaki-deploy"
     ```
     Press Enter three times to accept defaults.
   - Print your public key:
     ```bash
     # Mac / Linux:
     cat ~/.ssh/id_ed25519.pub
     # Windows (PowerShell):
     Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
     ```
   - Copy the entire line (starts with `ssh-ed25519`).
   - Paste it into DigitalOcean's **"SSH key content"** box.
   - Name it `whanaki-key` and click **Add SSH Key**.
7. **Hostname:** Change it to `whanaki-app`.
8. Click **"Create Droplet"**.
9. Wait 30–60 seconds for creation to finish.
10. **Copy the Public IPv4 address** (e.g. `123.456.78.90`). Save it in your text file:
    `DROPLET_IP=123.456.78.90`

> **What just happened?** DigitalOcean created a fresh Linux computer in a Sydney data center. You will install your app on it. The SSH key lets you log in securely without a password.

---

## Part 4 — Create Managed Database & Valkey

The application needs two persistent services that are **not** included in `docker-compose.prod.yml`:
1. **PostgreSQL** — the main database.
2. **Valkey (Redis-compatible)** — the cache and rate-limit store.

We recommend DigitalOcean's **Managed Databases**. They cost a bit more, but they handle backups, security patches, and maintenance for you. This is much safer than running a database inside a Docker container on a single server.

### Part 4.1 — Create Managed PostgreSQL

1. In the DigitalOcean dashboard, click the green **"Create"** button, then select **"Databases"**.
2. **Choose a database engine:** Select **PostgreSQL**.
3. **Choose a cluster configuration:** Select the smallest size:
   - **1 GB RAM / 1 vCPU / 10 GB Disk** (~$15/month)
4. **Choose a datacenter:** Select **Sydney**.
5. **Choose a unique name:** Enter `whanaki-db`.
6. Click **"Create a Database Cluster"**.
7. It will take 5–10 minutes to provision. Once ready, you will land on the database overview page.
8. On the overview page, look for the **"Connection Details"** box.
9. Make sure **"Connection parameters"** is selected (not the dropdown).
10. Copy the full **Connection String**. It looks like:
    ```
    postgresql://doadmin:YOUR_PASSWORD@db-host.ondigitalocean.com:25060/defaultdb?sslmode=require
    ```
11. **You must modify this string slightly.** Replace `postgresql://` with `postgresql+asyncpg://`, and replace `sslmode=require` with `ssl=require`. The final string should look like:
    ```
    postgresql+asyncpg://doadmin:YOUR_PASSWORD@db-host.ondigitalocean.com:25060/defaultdb?ssl=require
    ```
12. **Save this string in your text file** as `DATABASE_URL`.

#### Secure the Database (Firewall)

By default, the database is open to the internet. You must restrict it so only your `whanaki-app` droplet can connect.

1. On the database overview page, click the **"Settings"** tab.
2. Scroll down to the **"Trusted Sources"** section.
3. Click **"Edit"**.
4. You will see a text box for entering IP addresses or CIDR ranges. **Ignore this for now.**
5. Below that (or in the same modal), look for the **"Quick select"** section.
6. Click the **"Droplets"** option.
7. A dropdown or list will appear showing all your Droplets. Find and select **`whanaki-app`**.
8. You will see your Droplet's IP address automatically appear in the allowed list.
9. Click **"Save"**.

> **What does this do?** It tells DigitalOcean: "Only accept database connections from the `whanaki-app` server. Reject everything else." This is a critical security step.
> 
> **Why not use CIDR?** You *could* type your Droplet's IP address manually into the text box, but using the **Droplets** quick-select is easier and prevents typos. It also automatically updates if you resize or migrate the Droplet later.

### Part 4.2 — Create Managed Valkey (Redis-compatible)

DigitalOcean no longer offers "Redis" as a standalone managed database. Instead, they offer **Valkey** — a fully compatible fork of Redis that works with all the same clients and libraries. The Whānaki backend will connect to Valkey exactly as if it were Redis.

1. In the DigitalOcean dashboard, click the green **"Create"** button, then **"Databases"**.
2. **Choose a database engine:** Select **Valkey**.
3. **Choose a cluster configuration:** Select the smallest size:
   - **1 GB RAM / 1 vCPU / 10 GB Disk** (~$15/month)
4. **Choose a datacenter:** Select **Sydney**.
5. **Choose a unique name:** Enter `whanaki-valkey`.
6. Click **"Create a Database Cluster"**.
7. Once provisioning finishes, go to the Valkey overview page.
8. In the **"Connection Details"** box, copy the full **Connection String**.
9. It may look like one of these:
    ```
    valkeys://default:YOUR_PASSWORD@valkey-host.ondigitalocean.com:25061
    redis://default:YOUR_PASSWORD@valkey-host.ondigitalocean.com:25061
    ```
    *(If it starts with `valkeys://`, change it to `rediss://`. If it starts with `valkey://`, change it to `redis://`. The Python Redis client understands `redis://` and `rediss://`, but not `valkey://`.)*
10. **Save this string in your text file** as `REDIS_URL`.

#### Secure Valkey (Firewall)

1. On the Valkey overview page, click the **"Settings"** tab.
2. Scroll down to the **"Trusted Sources"** section.
3. Click **"Edit"**.
4. In the **"Quick select"** section, click **"Droplets"**.
5. Find and select **`whanaki-app`** from the list.
6. You will see your Droplet's IP address automatically appear in the allowed list.
7. Click **"Save"**.

> **Why two separate managed services?** Running PostgreSQL and Valkey/Redis inside Docker on your single app server is fine for local development, but risky for production. If the server crashes or you accidentally delete a container, you could lose data. Managed databases survive independently and take automated backups.

---

## Part 5 — Connect Your Domain Name

Your domain is **`whanaki.kaurilabs.kiwi`**. Right now, it doesn't know about your new server. You need to create **DNS records** to connect them.

### What is DNS?

DNS is the phone book of the internet. When someone types `whanaki.kaurilabs.kiwi`, their browser asks the DNS phone book: "What is the IP address for this name?" We need to add an entry that says: "`whanaki.kaurilabs.kiwi` points to your DigitalOcean Droplet IP."

### Step 5.1: Log In to Your Domain Registrar

You need to access the control panel for `kaurilabs.kiwi` (or specifically `whanaki.kaurilabs.kiwi`). This is where you bought the domain.

### Step 5.2: Create DNS A Records

Find the section called **"DNS"**, **"DNS Management"**, or **"Nameservers"**.

Create **two A records**:

| Type | Host / Name | Value / Points to | TTL |
|---|---|---|---|
| A | `whanaki` | `YOUR_DROPLET_IP` | Auto |
| A | `api` | `YOUR_DROPLET_IP` | Auto |

> **Note:** Some registrars want the full domain (`whanaki.kaurilabs.kiwi`) in the Host field. Others just want the prefix (`whanaki`). If you're unsure, try the prefix first. If your registrar uses the full domain, enter `whanaki.kaurilabs.kiwi` and `api.whanaki.kaurilabs.kiwi`.

### Step 5.3: Wait for Propagation

DNS changes spread across the internet over a few minutes.

Wait **5 minutes**, then open a terminal on your computer and run:

```bash
dig whanaki.kaurilabs.kiwi +short
dig api.whanaki.kaurilabs.kiwi +short
```

*(On Windows, if `dig` is not found, use an online checker like https://whatsmydns.net.)*

**Both commands should print your Droplet IP address.** If they don't, wait another 5 minutes and try again. **Do not proceed until both commands work.**

---

## Part 6 — Run the Automatic Server Setup

Now we log into your server and run a script that automates the complex stuff: installing Docker, getting an SSL certificate, setting up the firewall, and cloning your code.

### Step 6.1: SSH Into Your Droplet

Open your terminal / PowerShell and run:

```bash
ssh root@YOUR_DROPLET_IP
```

For example:
```bash
ssh root@123.456.78.90
```

**The first time you connect, you will see:**
```
The authenticity of host '123.456.78.90' can't be established.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Type `yes` and press Enter.

**You should now see:**
```
root@whanaki-app:~#
```

This means you are inside your server.

### Step 6.2: Download and Run the Setup Script

We prepared a script in this repository. You will download it and run it.

Copy and paste these commands **one at a time** into your SSH session:

```bash
# Download the setup script
curl -fsSL https://raw.githubusercontent.com/Kaurilabs2803/whanaki/main/infra/scripts/setup-server.sh -o setup-server.sh

# Make it executable
chmod +x setup-server.sh

# Run it
./setup-server.sh

> **If you see `/bin/bash^M: bad interpreter`:** This happens when the file was copied from a Windows computer and has Windows-style line endings. Fix it with:
> ```bash
> sed -i 's/\r$//' setup-server.sh
> ./setup-server.sh
> ```
```

> **Important:** Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

**What this script does (explained):**
1. **Updates Ubuntu** — installs security patches.
2. **Installs Docker** — the tool that runs your app in isolated containers.
3. **Configures the Firewall** — blocks all traffic except SSH (port 22), HTTP (port 80), and HTTPS (port 443).
4. **Gets an SSL Certificate** — uses free Let's Encrypt (via `certbot`) to enable `https://`. Covers both `whanaki.kaurilabs.kiwi` and `api.whanaki.kaurilabs.kiwi`.
5. **Clones the Repository** — downloads your code from GitHub into `/opt/whanaki`.
6. **Sets up Auto-Renewal** — SSL certificates expire every 90 days. The script installs a background timer that renews them automatically.

**This takes 3–5 minutes.** You will see a lot of text scrolling by. This is normal.

### Alternative: Copy the Script Manually

If the `curl` command fails (e.g., your repo is private), run this from your **local computer** instead:

```bash
scp whanaki/infra/scripts/setup-server.sh root@YOUR_DROPLET_IP:/root/
ssh root@YOUR_DROPLET_IP
chmod +x setup-server.sh
./setup-server.sh
```

> **If you see `/bin/bash^M: bad interpreter`:** This happens when the file was copied from a Windows computer and has Windows-style line endings. Fix it with:
> ```bash
> sed -i 's/\r$//' setup-server.sh
> ./setup-server.sh
> ```

---

## Part 7 — Configure the Application

Your server has the code, but the app doesn't know the secret keys yet. We store these in a file called `.env`.

### Step 7.1: What is the `.env` File?

`.env` is a simple text file containing configuration and secrets. The application reads it when it starts. **Never commit this file to GitHub.** It should only live on your server (and your local computer for development).

### Step 7.2: Create the `.env` File on the Server

While still SSH'd into your server, run:

```bash
cd /opt/whanaki
cp .env.production.example .env
nano .env
```

This opens a text editor. You are looking at a **template** where every production value is already filled in for `whanaki.kaurilabs.kiwi`. You only need to paste your **secrets**.

### Step 7.3: Fill In Each Section

Use the arrow keys to move around. Replace the placeholder values after the `=` sign.

#### Clerk Auth

```bash
CLERK_SECRET_KEY=sk_test_...          # Paste from Part 1
CLERK_PUBLISHABLE_KEY=pk_test_...     # Paste from Part 1
```

#### Stripe Billing

```bash
STRIPE_SECRET_KEY=sk_test_...         # Paste from Part 2
STRIPE_WEBHOOK_SECRET=whsec_...       # Paste from Part 2
STRIPE_PRICE_STARTER=price_...        # Paste from Part 2
STRIPE_PRICE_PROFESSIONAL=price_...   # Paste from Part 2
STRIPE_PRICE_ENTERPRISE=price_...     # Paste from Part 2
```

#### RAGFlow API Key

Generate a random key:
```bash
openssl rand -hex 24
```

Copy the output and paste it here:
```bash
RAGFLOW_API_KEY=76ab5671edd63b6576f28059
```

#### Elasticsearch Password

Generate a password:
```bash
openssl rand -hex 16
```

Paste it:
```bash
ELASTIC_PASSWORD=fed3044f3fa2731c
```

#### Ollama Host

**For beginners, the simplest option is to install Ollama directly on the same droplet** (see the Appendix at the end of this guide). In that case, leave this as-is:
```bash
OLLAMA_HOST=http://172.17.0.1:11434
```

If you have a separate Ollama droplet, use its private IP instead:
```bash
OLLAMA_HOST=http://10.10.0.2:11434
```

#### App Settings

Generate a strong secret key:
```bash
openssl rand -hex 32
```

Paste it:
```bash
SECRET_KEY=your-super-secret-key-here
```

The other app settings (`DOMAIN`, `APP_URL`, `ALLOWED_ORIGINS`) are already correct for `whanaki.kaurilabs.kiwi`.

#### Database & Valkey

Paste the connection strings you copied in **Part 4**:

```bash
DATABASE_URL=postgresql+asyncpg://doadmin:PASSWORD@db-host:25060/defaultdb?ssl=require
REDIS_URL=rediss://default:PASSWORD@valkey-host:25061
```

#### Next.js (Frontend)

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...     # Same as CLERK_PUBLISHABLE_KEY
```

The other `NEXT_PUBLIC_*` values are already correct.

### Step 7.4: Save and Exit Nano

1. Press `Ctrl + O` (the letter O) to save.
2. Press `Enter` to confirm.
3. Press `Ctrl + X` to exit.

---

## Part 8 — Start the Application for the First Time

This is the exciting part. You are about to turn on the app.

### Step 8.1: What is Docker Compose?

`docker-compose.prod.yml` is a recipe file. It tells Docker:
- "Start a backend container"
- "Start a frontend container"
- "Start RAGFlow and Elasticsearch containers"
- "Start an Nginx container"
- "Connect them all to the same private network"

We use Docker Compose so you don't have to install Python, Node.js, Nginx, and Elasticsearch directly onto the server operating system. They run inside isolated **containers**.

### Step 8.2: Start All Services

While SSH'd into the server, run:

```bash
cd /opt/whanaki
docker compose -f docker-compose.prod.yml up -d --scale backend=2
```

**What this does:**
- `docker compose` talks to Docker.
- `-f docker-compose.prod.yml` says "use the production recipe."
- `up -d` says "start everything in the background."
- `--scale backend=2` says "run two copies of the backend" for redundancy.

**The first time you run this, it takes 5–10 minutes.** Docker downloads base images and builds your backend and frontend.

### Step 8.3: Check What is Running

After it finishes, run:

```bash
docker compose -f docker-compose.prod.yml ps
```

You should see a table showing:
- `backend` (x2)
- `frontend`
- `ragflow`
- `ragflow-es`
- `ragflow-infinity`
- `nginx`
- `vector`

If any container says `Exited`, check the logs:

```bash
docker compose -f docker-compose.prod.yml logs -f ragflow-es
```

> **Note:** Elasticsearch usually takes 60–90 seconds to start. It is normal for `ragflow` to restart a few times while waiting.

### Step 8.4: Run Database Migrations

**What is a migration?**  
Your code defines what database tables should look like (e.g. "users have an email column"). A migration is a script that creates or updates those tables in the real PostgreSQL database.

Run:

```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

You should see:
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
```

### Step 8.5: Verify the Health Endpoint

Your backend has a `/health` URL that checks if all services are connected.

Run:

```bash
curl https://api.whanaki.kaurilabs.kiwi/health | python3 -m json.tool
```

**Expected output:**
```json
{
    "status": "ok",
    "services": {
        "postgres": { "status": "ok", "latency_ms": 3.5 },
        "redis": { "status": "ok", "latency_ms": 1.2 },
        "ollama": { "status": "ok", "detail": "Models: llama3.2:3b, llama3.1:8b" },
        "ragflow": { "status": "ok", "latency_ms": 42.0 }
    },
    "version": "1.0.0"
}
```

If `ragflow` shows `"down"`, wait 60 seconds and retry.

### Step 8.6: Visit Your Website

Open your browser and go to:

```
https://whanaki.kaurilabs.kiwi
```

You should see the Whānaki landing page.

**Try signing up:**
1. Click **"Get started"** or **"Sign up"**.
2. Enter an email and password.
3. You should be redirected to `/onboarding`.
4. Enter an organisation name (e.g. `my-test-org`) and your name.
5. You should land on the **Dashboard**.

If this works, your application is live on the internet!

---

## Part 9 — Enable Push-to-Deploy (GitHub Actions)

Right now, if you change code and push it to GitHub, nothing happens on the server. We need to connect GitHub to your DigitalOcean server so that successful code pushes automatically trigger a deployment.

### What is GitHub Actions?

GitHub Actions is a built-in automation service. It can run tests, build your app, and connect to your server to deploy changes. It reads workflow files from your repository (the `.github/workflows/` folder).

You already have two workflow files:
- `ci.yml` — runs tests and linting.
- `deploy.yml` — deploys to DigitalOcean, but only after CI passes.

To make `deploy.yml` work, you must give GitHub the keys to log into your server.

### Step 9.1: Get Your SSH Private Key

In Part 3, you generated an SSH key pair. You gave DigitalOcean the **public** key. GitHub now needs the matching **private** key.

**On your local computer**, run:

```bash
# Mac / Linux:
cat ~/.ssh/id_ed25519

# Windows (PowerShell):
Get-Content $env:USERPROFILE\.ssh\id_ed25519
```

This prints your private key. It looks like:

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACB...
...many more lines...
-----END OPENSSH PRIVATE KEY-----
```

**Copy the entire block** (from `-----BEGIN` to `-----END`).

### Step 9.2: Add GitHub Secrets

1. Go to your repository on GitHub: `https://github.com/YOUR_USERNAME/whanaki`.
2. Click the **"Settings"** tab.
3. In the left sidebar, click **"Secrets and variables"** → **"Actions"**.
4. Click the green **"New repository secret"** button.
5. Create these three secrets one by one:

| Name | Value |
|---|---|
| `DO_PRODUCTION_IP` | Your Droplet's Public IPv4 address (e.g. `123.456.78.90`) |
| `DO_SSH_USER` | `root` |
| `DO_SSH_KEY` | The entire private key you copied in Step 9.1 |

**Important:** When pasting `DO_SSH_KEY`, make sure you include the `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines.

### What These Secrets Do

- `DO_PRODUCTION_IP`: Tells GitHub which server to connect to.
- `DO_SSH_USER`: Tells GitHub which user account to use (`root`).
- `DO_SSH_KEY`: The passwordless key that proves GitHub is allowed to log in.

When you push to `main`, GitHub Actions reads these secrets, SSHs into your droplet, pulls the latest code, rebuilds the Docker images, and restarts the app.

---

## Part 10 — Verify Your Auto-Deploy Pipeline

Let's test that everything is wired together.

### Step 10.1: Make a Small Change

On your local computer, make any tiny change you can easily verify. For example, edit `frontend/src/app/page.tsx` and change a heading.

### Step 10.2: Commit and Push

Open your terminal in the project folder and run:

```bash
git add .
git commit -m "chore: test auto-deploy pipeline"
git push origin main
```

### Step 10.3: Watch GitHub Actions Run

1. Go to your GitHub repository in your browser.
2. Click the **"Actions"** tab.
3. You should see a workflow run called **"CI"** starting.
4. After CI finishes, **"Deploy to Production"** will start.
5. Click on the deploy run to watch the live logs.

**You should see:**
```
--- Pulling latest code ---
--- Building changed images ---
--- Restarting application services ---
--- Running database migrations ---
--- Health check ---
--- Deploy complete ---
```

### Step 10.4: Confirm the Change is Live

Wait about 1 minute after "Deploy complete", then refresh `https://whanaki.kaurilabs.kiwi`. You should see your change.

**Congratulations!** From now on, every push to `main` updates your live site automatically.

---

## Part 11 — Everyday Operations

### View Server Logs

```bash
ssh root@YOUR_DROPLET_IP
cd /opt/whanaki

# All services
docker compose -f docker-compose.prod.yml logs -f

# Only backend
docker compose -f docker-compose.prod.yml logs -f backend

# Structured JSON logs (Vector aggregation)
docker compose -f docker-compose.prod.yml exec vector \
  tail -f /var/log/whanaki/$(date +%Y-%m-%d).ndjson
```

### Deploy Manually (If GitHub Actions Breaks)

```bash
ssh root@YOUR_DROPLET_IP
cd /opt/whanaki
make update
```

This is equivalent to:
```bash
git pull origin main
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d --scale backend=2 backend frontend
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head
```

### Update Environment Variables

```bash
ssh root@YOUR_DROPLET_IP
cd /opt/whanaki
nano .env
# Save changes, then restart:
docker compose -f docker-compose.prod.yml up -d --scale backend=2
```

### Restart a Single Service

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

### Run Tests Locally

```bash
make test
```

---

## Part 12 — Troubleshooting

### "Permission denied (publickey)" when trying to SSH

**Cause:** Your SSH key isn't being offered.

**Fix:**
1. Make sure you are using the private key that matches the public key added to DigitalOcean.
2. Explicitly specify the key:
   ```bash
   ssh -i ~/.ssh/id_ed25519 root@YOUR_DROPLET_IP
   ```
3. On Windows, check that `C:\Users\YOURNAME\.ssh\id_ed25519` exists.

### "Could not resolve host: whanaki.kaurilabs.kiwi"

**Cause:** DNS hasn't propagated, or records are wrong.

**Fix:**
1. Check your DNS A records at your domain registrar.
2. Use https://whatsmydns.net to check global status.
3. Wait up to 30 minutes.

### "Certbot failed: Port 80 is already in use"

**Cause:** Something is running on port 80.

**Fix:**
```bash
ss -tlnp | grep ':80 '
systemctl stop apache2  # or nginx, if running on the host
```
Then re-run the setup script.

### "RAGFlow: down" in health check

**Cause:** Elasticsearch is still starting, or out of memory.

**Fix:**
1. Wait 90 seconds and retry.
2. Check Elasticsearch logs:
   ```bash
   docker compose -f docker-compose.prod.yml logs -f ragflow-es
   ```
3. If you see `OutOfMemoryError`, upgrade to a larger DigitalOcean droplet.

### "Ollama: down" in health check

**Cause:** The backend cannot reach the Ollama host.

**Fix:**
1. Verify `OLLAMA_HOST` in `.env` is correct.
2. If Ollama is on a separate droplet, SSH to it:
   ```bash
   systemctl status ollama
   ufw status
   ```
3. If Ollama is on the same droplet, follow the Appendix below to verify it is installed and listening.

### GitHub Actions Deploy Fails at "Health check"

**Cause:** The app needs more time to start.

**Fix:**
1. Check container status:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```
2. Check backend logs for startup errors.
3. Edit `.github/workflows/deploy.yml` and increase `sleep 5` to `sleep 15`.

### "502 Bad Gateway" when visiting the site

**Cause:** Nginx is running, but the backend or frontend is down.

**Fix:**
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml restart backend
```

---

## Glossary

| Term | Meaning |
|---|---|
| **A Record** | A DNS record that maps a domain name to an IP address. |
| **CI/CD** | Continuous Integration / Continuous Deployment. Automatically testing and deploying code. |
| **Container** | A lightweight, isolated environment for running software. |
| **Droplet** | DigitalOcean's name for a Virtual Private Server (VPS). |
| **Docker** | A tool that packages and runs applications in containers. |
| **Docker Compose** | A tool that manages multiple Docker containers using a recipe file. |
| **DNS** | The "phone book of the internet." Converts domain names to IP addresses. |
| **Environment Variable** | A configuration value passed to a running program. |
| **Firewall** | A security system that blocks unwanted network traffic. |
| **GitHub Actions** | GitHub's automation platform for tests and deployments. |
| **Nginx** | A high-performance web server and reverse proxy. |
| **Migration** | A script that creates or updates database tables. |
| **Reverse Proxy** | A server that forwards internet traffic to the correct internal service. |
| **SSL Certificate** | A digital certificate that enables HTTPS (the browser padlock). |
| **SSH** | Secure Shell. A protocol for logging into remote computers securely. |
| **SSH Key** | A pair of cryptographic keys used to authenticate SSH without passwords. |
| **VPC** | Virtual Private Cloud. A private network for your servers. |
| **Webhook** | An HTTP request sent automatically when an event happens. |

---

## Appendix: Ollama on the Same Droplet

For the simplest and cheapest setup, you can install Ollama directly on your main `whanaki-app` droplet instead of buying a second server.

> **Trade-off:** Ollama uses a lot of RAM and CPU. If you run it on the same droplet as your website, large AI queries may slow down the website. For low-traffic starters, this is fine.

### Step A.1: Install Ollama

SSH into your main droplet and run:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Step A.2: Configure Ollama to Accept Network Connections

By default, Ollama only listens on `localhost` (inside the server). Docker containers need to reach it over the network.

```bash
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/environment.conf <<EOF
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=*"
Environment="OLLAMA_KEEP_ALIVE=10m"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
EOF

systemctl daemon-reload
systemctl enable ollama
systemctl restart ollama
```

### Step A.3: Open the Firewall for Docker

Docker containers on Linux use internal IP ranges like `172.17.0.x`. Allow them to reach Ollama:

```bash
ufw allow from 172.16.0.0/12 to any port 11434
```

### Step A.4: Update Your `.env`

Make sure your `/opt/whanaki/.env` contains:

```bash
OLLAMA_HOST=http://172.17.0.1:11434
```

> **Why `172.17.0.1`?** This is the default IP address of the host machine as seen from inside Docker containers on Linux. It allows the backend container to talk to Ollama running on the host.

### Step A.5: Pull the Required Models

```bash
ollama pull nomic-embed-text
ollama pull llama3.2:3b
ollama pull llama3.1:8b
```

Verify they are downloaded:
```bash
ollama list
```

### Step A.6: Restart the Backend

```bash
cd /opt/whanaki
docker compose -f docker-compose.prod.yml restart backend
```

Wait 10 seconds, then run the health check again:
```bash
curl https://api.whanaki.kaurilabs.kiwi/health | python3 -m json.tool
```

Ollama should now show `"status": "ok"`.
