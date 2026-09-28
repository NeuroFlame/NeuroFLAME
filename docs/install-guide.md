# Installing the NeuroFLAME Desktop App

This covers downloading and installing the desktop app itself, plus the
one thing every platform needs to actually **run** a computation: Docker
(or, on Linux, Singularity/Apptainer as an alternative). You don't need
it just to install and log in — only once you're ready to join a
consortium and run something.

## 1. Download

Go to the [latest release](https://github.com/NeuroFlame/NeuroFLAME/releases/latest)
and download the file for your operating system:

| Platform | File |
| --- | --- |
| macOS | `NeuroFLAME-<version>.dmg` |
| Windows | `NeuroFLAME-Setup-<version>.exe` |
| Linux | `NeuroFlame-<version>-linux.AppImage` |

## 2. Install

### macOS

1. Open the downloaded `.dmg`.
2. Drag **NeuroFLAME** into the **Applications** folder shown in the window.
3. Open it from Applications (or Spotlight) like any other app.

The app is signed and notarized by Apple, so it should open normally with
no extra steps. If macOS still blocks it as "from an unidentified
developer," right-click the app in Applications and choose **Open** once
— that one-time override isn't needed for a properly notarized build,
but covers you if something about a specific release didn't staple
correctly.

### Windows

1. Run the downloaded `.exe`. It's a one-click installer — no wizard
   screens, it installs and launches automatically.
2. Windows SmartScreen will very likely show a **"Windows protected your
   PC"** warning first — the installer isn't currently code-signed. Click
   **More info**, then **Run anyway**.

### Linux

1. Make the AppImage executable, then run it:

   ```bash
   chmod +x NeuroFlame-<version>-linux.AppImage
   ./NeuroFlame-<version>-linux.AppImage
   ```

2. If it fails to launch with an error mentioning `libfuse.so.2`, your
   distro needs the FUSE2 compatibility library (AppImages need it to
   mount themselves) — this is common on newer distros (Ubuntu 24.04+,
   Fedora 40+) where it isn't installed by default:

   ```bash
   # Debian/Ubuntu
   sudo apt-get install -y libfuse2

   # Fedora
   sudo dnf install -y fuse-libs
   ```

Automatic updates only work when NeuroFLAME is launched from the
AppImage itself, with both the AppImage and its containing directory
writable by your user — keep it somewhere like `~/Applications` rather
than a read-only or system location if you want update prompts to work.

## 3. Prerequisite for running computations: Docker (or Singularity)

The app can run without this — you can install it, log in, and browse
consortia with nothing else set up. You only need a container runtime
once you're actually going to run a computation.

### macOS and Windows: Docker Desktop

```
https://www.docker.com/products/docker-desktop/
```

Download, install, and make sure it's actually running (its whale icon
shows in the menu bar / system tray) before starting a run. That's the
whole requirement — no configuration inside NeuroFLAME needed, Docker is
the default.

#### Windows: if Docker Desktop won't start

On Windows, Docker Desktop runs containers inside WSL2, which needs CPU
virtualization (Intel VT-x / AMD-V) turned on. Two things commonly block
this, especially on OEM or corporate laptops where it's off by default:

1. **Check whether virtualization is on**, without touching the BIOS:
   open Task Manager → **Performance** tab → **CPU** — it shows
   "Virtualization: Enabled" or "Disabled" near the bottom.
2. **If it's disabled**, it needs to be turned on in the BIOS/UEFI setup
   (reboot and enter BIOS setup — the key and menu name vary by
   manufacturer, e.g. "Intel VT-x," "SVM Mode," "Virtualization
   Technology"), then run `wsl --install` from an administrator
   PowerShell prompt to set up WSL2 itself.

The tell-tale sign of this exact problem is Docker Desktop failing with
an error like `WslRegisterDistribution failed with error 0x80370102`.

If this is a **work-managed machine**, BIOS settings and Hyper-V/Device
Guard policy are frequently locked down by IT and can't be changed from
inside Windows — if the steps above aren't available to you, this needs
your IT department rather than a workaround.

### Linux: Docker Engine, or Singularity/Apptainer

**Docker**, if you're on a personal machine or a VM you fully control:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# log out and back in (group membership needs a fresh session)
```

**Singularity or Apptainer**, if this is a shared machine where you don't
have root — the common choice on HPC-style setups, since it doesn't need
root to actually run containers. Check whether it's already available
before installing anything:

```bash
which singularity apptainer
```

If it's Singularity/Apptainer rather than Docker, tell NeuroFLAME so in
its settings (Docker is the default) — see the app's own Settings panel,
or `neuroflame edge set-container-service singularity` if you're also
using [the command-line client](../cliAppClient/README.md).

## 4. Verify it's working

Open the app, log in, and check **Settings** — it should show your
central server as reachable. If you're planning to run computations,
confirm Docker (or Singularity) is actually running before joining a
consortium; the app will tell you clearly if a run fails because no
container runtime is available.
