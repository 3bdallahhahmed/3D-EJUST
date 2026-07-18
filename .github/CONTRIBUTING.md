# Contributing to Centurai Print OS

We use an **Environment-Based Branching** workflow to keep the repository clean, stable, and professional.

## Branch Strategy

We maintain two primary branches:

1.  **`main`**: The production branch. This represents the live, stable codebase. **Never push directly to `main`.**
2.  **`development`**: The active working branch. All new features, bug fixes, and day-to-day work are committed here.

## Your Daily Workflow

1.  **Check out the development branch:**
    Always ensure you are working on the `development` branch.
    ```bash
    git checkout development
    git pull origin development
    ```

2.  **Make your changes:**
    Write code, fix bugs, or update text.

3.  **Commit your changes:**
    Write clear and concise commit messages.
    ```bash
    git add .
    git commit -m "Add new printer status dashboard"
    ```

4.  **Push to GitHub:**
    ```bash
    git push origin development
    ```

## Releasing to Production (`main`)

When you are ready to update the live production site:
1.  Go to the repository on GitHub.
2.  Click **"Compare & pull request"**.
3.  Set the base branch to `main` and the compare branch to `development`.
4.  Fill out the Pull Request template.
5.  Merge the Pull Request. This acts as a formal "release" of your code.
