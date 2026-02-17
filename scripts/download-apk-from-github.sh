#!/bin/bash

# Скрипт для скачивания APK из GitHub Actions артефактов

REPO="ivanplat1/DrinkNote"
WORKFLOW_NAME="Build Android APK"
OUTPUT_DIR="./downloads"
BRANCH="${1:-feature/preview-premium-activation}"

echo "Downloading APK from GitHub Actions..."
echo "Repository: $REPO"
echo "Workflow: $WORKFLOW_NAME"
echo "Branch: $BRANCH"
echo ""

# Проверка GitHub CLI
if ! command -v gh &> /dev/null; then
  echo "GitHub CLI (gh) not found."
  echo ""
  echo "Quick install:"
  echo "  brew install gh"
  echo "  gh auth login"
  echo ""
  echo "Or download manually from GitHub Actions:"
  echo "  1. Go to: https://github.com/$REPO/actions"
  echo "  2. Click on latest 'Build Android APK' workflow"
  echo "  3. Scroll down to 'Artifacts' section"
  echo "  4. Download 'drinknote-apk'"
  echo ""
  read -p "Install GitHub CLI now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v brew &> /dev/null; then
      brew install gh
      echo "After installation, run: gh auth login"
    else
      echo "Homebrew not found. Install manually: https://cli.github.com/"
    fi
  fi
  exit 1
fi

# Проверка авторизации
if ! gh auth status &> /dev/null; then
  echo "Not authenticated with GitHub."
  echo ""
  read -p "Authenticate now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting GitHub authentication..."
    gh auth login
    if [ $? -ne 0 ]; then
      echo "Authentication failed. Please run manually: gh auth login"
      exit 1
    fi
  else
    echo "Authentication required. Run: gh auth login"
    exit 1
  fi
fi

# Создать директорию для загрузок
mkdir -p "$OUTPUT_DIR"

echo "Finding latest workflow run..."
WORKFLOW_RUN=$(gh run list --workflow="$WORKFLOW_NAME" --branch="$BRANCH" --repo="$REPO" --limit=1 --json databaseId,status,conclusion --jq '.[0]')

if [ -z "$WORKFLOW_RUN" ] || [ "$WORKFLOW_RUN" = "null" ]; then
  echo "No workflow runs found for branch '$BRANCH'"
  echo ""
  echo "Available branches with runs:"
  gh run list --workflow="$WORKFLOW_NAME" --repo="$REPO" --limit=10 --json headBranch --jq '.[].headBranch' | sort -u
  exit 1
fi

RUN_ID=$(echo "$WORKFLOW_RUN" | jq -r '.databaseId')
STATUS=$(echo "$WORKFLOW_RUN" | jq -r '.status')
CONCLUSION=$(echo "$WORKFLOW_RUN" | jq -r '.conclusion')

echo "Found run: $RUN_ID"
echo "Status: $STATUS"
echo "Conclusion: $CONCLUSION"
echo ""

if [ "$STATUS" != "completed" ]; then
  echo "Workflow is still running. Wait for it to complete."
  echo "View progress: https://github.com/$REPO/actions/runs/$RUN_ID"
  exit 1
fi

if [ "$CONCLUSION" != "success" ]; then
  echo "Workflow did not complete successfully."
  echo "View details: https://github.com/$REPO/actions/runs/$RUN_ID"
  exit 1
fi

echo "Downloading artifacts..."
ARTIFACTS=$(gh run view "$RUN_ID" --repo="$REPO" --json artifacts --jq '.artifacts[] | select(.name == "drinknote-apk")')

if [ -z "$ARTIFACTS" ]; then
  echo "No APK artifact found in this run."
  echo "Available artifacts:"
  gh run view "$RUN_ID" --repo="$REPO" --json artifacts --jq '.artifacts[].name'
  exit 1
fi

ARTIFACT_ID=$(echo "$ARTIFACTS" | jq -r '.id')
ARTIFACT_NAME=$(echo "$ARTIFACTS" | jq -r '.name')

echo "Downloading artifact: $ARTIFACT_NAME (ID: $ARTIFACT_ID)"
gh run download "$RUN_ID" --repo="$REPO" --name="$ARTIFACT_NAME" --dir="$OUTPUT_DIR"

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ APK downloaded successfully!"
  echo ""
  echo "APK location:"
  find "$OUTPUT_DIR" -name "*.apk" -type f
  echo ""
  echo "To install on emulators:"
  echo "  ./scripts/test-apk-emulators.sh $OUTPUT_DIR/*.apk"
else
  echo "✗ Failed to download APK"
  exit 1
fi
