# NeuroFLAME User Guide

How to configure a study, run it, and look at the results, using the
NeuroFLAME desktop app. If you haven't installed the app yet, see the
[Install Guide](./install-guide.md) first.

## 1. Consortia

A **consortium** is the group running a study together — one **leader**
who configures and starts runs, and any number of **members** who each
contribute their own local data.

### Finding or joining one

Open the menu and click **Consortia** to see the full list
(`/consortium/list`). Each row shows the consortium's title, its
leader, and a **Join** button — click it to become a member. There's
no invite code needed to join a public consortium; it's a straight
browse-and-click. (Private consortia aren't visible this way — the
leader has to invite you by email instead, see below.)

### Creating one

From the Consortia list, click **Create A New Consortium**. You'll be
asked for a **Title**, an optional **Description**, and whether it's
**Private**. Submitting gives you two options: **Create and Use
Wizard** (a guided step-by-step setup, recommended) or **Create and
View Detail** (go straight to the consortium's detail page and
configure things manually in any order).

### Inviting people

As leader, open the consortium's detail page and click **Invite
Participants** — enter the person's **email** and click **Invite**.
This is the only way into a **private** consortium.

## 2. Configuring the study (leader)

From the consortium's detail page (or the setup wizard's **Select
Computation & Download Image** step), click **Select A Computation**
(it'll say **Change** if one's already picked) to choose which
computation module the study runs.

Once a computation is selected, set its parameters under **Global
Settings** — this is a JSON text box, not a form, so parameters go in
as raw JSON (the box validates it and flags invalid JSON before you
can save). If the computation also supports per-member settings, a
**Local Settings** tab appears for each member's own values.

If you're using the wizard, these are the **Add Vault User
(Optional)**, **Set Parameters**, and **Set Local Parameters**
steps — same underlying fields, just walked through one at a time. The
wizard also has an **Add Leader Notes (Optional)** step for leaving
members any context about the run.

## 3. Setting up your data (every member)

Every member — leader included, if you're also contributing data —
needs to point the app at their local dataset before they can run
anything. On the consortium's detail page (or the wizard's **Select
Data Directory** step), find **Data Directory** and click **Browse To
Select Data Directory** to pick the folder, or type/edit the path
directly and click **Save**.

## 4. Getting ready and starting a run

Once your data directory is set, flip the **Ready** switch (or click
**Set Yourself as "Ready"** — it changes to **You're Ready!** with a
green check once done). This is the wizard's final step for everyone,
leader and members alike.

Once enough members are ready, the leader clicks **Start Run** on the
consortium's detail page (it's disabled until there's at least one
active, ready participant). The button briefly shows **Run Started
(ID: ...)** to confirm it went through.

## 5. Monitoring a run

Open the menu and click **Runs** to see every run
(`/run/list`). Click into one for **Run Details**, which shows the
consortium, status, timestamps, each member's status, the study
configuration (computation, parameters, and the leader's notes), and
any errors if something went wrong.

A run moves through these statuses in order:

**Pending → Provisioning → Starting → In Progress → Complete → Error**

## 6. Viewing and interpreting results

Once a run reaches **Complete**, a **View Run Results** button appears
on its Run Details page. The results page shows:

- A **Files** panel on the left — a browsable folder/file tree of
  everything the computation produced.
- A viewer on the right for whatever file you click — CSVs, NIfTI
  images (`.nii`), `.mat` files, and text/code files all render
  inline; if the computation produced an `index.html` report (common
  for plots/summaries), that's what shows by default.
- A **Download Results** button to get everything as a zip.

If a run instead ends in **Error**, Run Details (and the results page,
if partial output exists) shows what failed — check there before
re-running.
