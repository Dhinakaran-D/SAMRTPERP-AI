/*
 * SmartPrep AI Frontend JavaScript
 * Handles all client-side interactions and API calls
 */

// Configuration
const API_BASE_URL =
  window.location.port === "5000"
    ? `${window.location.origin}/api`
    : "http://127.0.0.1:5000/api";
let currentTab = "upload";
let chatHistory = [];

console.log("🚀 Script loaded!");

// DOM Elements - will be null until DOM is ready
let navButtons, tabs, uploadBtn, sendBtn, generateMcqBtn, clearBtn, pdfFile;
let questionInput, mcqTopic, numQuestions, difficulty, mcqExamMode;
let uploadStatus, chatBox, mcqResult, analyticsList, spinner, toast;
let docCount, chunkCount, statusIndicator, modeSwitcher, modeToggle;
let modeIcon, modeText;

// Initialize DOM elements
function initializeDOM() {
  console.log("Initializing DOM elements...");
  navButtons = document.querySelectorAll(".nav-button");
  tabs = document.querySelectorAll(".tab");
  uploadBtn = document.getElementById("uploadBtn");
  sendBtn = document.getElementById("sendBtn");
  generateMcqBtn = document.getElementById("generateMcqBtn");
  clearBtn = document.getElementById("clearBtn");
  pdfFile = document.getElementById("pdfFile");
  questionInput = document.getElementById("questionInput");
  mcqTopic = document.getElementById("mcqTopic");
  numQuestions = document.getElementById("numQuestions");
  difficulty = document.getElementById("difficulty");
  mcqExamMode = document.getElementById("mcqExamMode");
  uploadStatus = document.getElementById("uploadStatus");
  chatBox = document.getElementById("chatBox");
  mcqResult = document.getElementById("mcqResult");
  analyticsList = document.getElementById("analyticsList");
  spinner = document.getElementById("spinner");
  toast = document.getElementById("toast");
  docCount = document.getElementById("docCount");
  chunkCount = document.getElementById("chunkCount");
  statusIndicator = document.getElementById("statusIndicator");
  modeSwitcher = document.getElementById("modeSwitcher");
  modeToggle = document.getElementById("modeToggle");
  modeIcon = document.getElementById("modeIcon");
  modeText = document.getElementById("modeText");

  // Setup lazy loading for animation observer
  document.querySelectorAll("[data-lazy-animate]").forEach((el) => {
    animationObserver.observe(el);
  });

  console.log("generateMcqBtn:", generateMcqBtn);
  console.log("mcqResult:", mcqResult);
}

// Global state
let currentMode = "online";
let ollamaAvailable = false;
let geminiAvailable = false;

function initializeTheme() {
  localStorage.setItem("smartprep-theme", "red");
  document.body.setAttribute("data-theme", "red");
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", "#ef4444");
  root.style.setProperty("--theme-secondary", "#f87171");
  root.style.setProperty("--theme-accent", "#dc2626");
}

// ===== PERFORMANCE OPTIMIZATION =====
// Request Animation Frame debounce for resize events
let resizeTimeout;
window.addEventListener(
  "resize",
  () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      document.body.setAttribute("data-resizing", "false");
    }, 150);
  },
  { passive: true },
);

// Intersection Observer for lazy loading animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: "50px",
};

const animationObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in-view");
      animationObserver.unobserve(entry.target);
    }
  });
}, observerOptions);

// ===== KEYBOARD ACCESSIBILITY =====
document.addEventListener("keydown", (e) => {
  // Alt + Right/Left for tab navigation
  if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    e.preventDefault();
    const navButtons = document.querySelectorAll(".nav-button");
    const currentActive = document.querySelector(".nav-button.active");
    if (!currentActive || !navButtons.length) return;

    const currentIndex = Array.from(navButtons).indexOf(currentActive);
    let nextIndex = currentIndex + (e.key === "ArrowRight" ? 1 : -1);
    nextIndex = (nextIndex + navButtons.length) % navButtons.length;

    navButtons[nextIndex].click();
  }
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded!");
  initializeTheme();
  initializeApp();
});

// Fallback delegated click handling for sidebar navigation
document.addEventListener("click", (event) => {
  const navButton = event.target.closest(".nav-button[data-tab]");
  if (!navButton) return;

  switchTab({ currentTarget: navButton, target: navButton });
});

function initializeApp() {
  console.log("=== Initializing App ===");

  // Initialize DOM elements first
  initializeDOM();

  console.log("generateMcqBtn element:", generateMcqBtn);
  console.log("mcqResult element:", mcqResult);

  // Setup event listeners
  navButtons.forEach((btn) => {
    btn.addEventListener("click", switchTab);
  });

  if (uploadBtn) {
    uploadBtn.addEventListener("click", handleUploadPDF);
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", handleSendQuestion);
  }

  if (generateMcqBtn) {
    console.log("Adding click listener to generateMcqBtn");
    generateMcqBtn.addEventListener("click", handleGenerateMCQ);
  } else {
    console.error("generateMcqBtn element not found!");
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", handleClearDatabase);
  }

  // Enter key to send message
  if (questionInput) {
    questionInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleSendQuestion();
      }
    });
  }

  // Quick suggestion buttons
  const suggestionBtns = document.querySelectorAll(".suggestion-btn");
  suggestionBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const suggestion = btn.getAttribute("data-suggestion");
      if (suggestion) {
        questionInput.value = suggestion;
        handleSendQuestion();
      }
    });
  });

  // Clear chat button
  const clearChatBtn = document.getElementById("clearChatBtn");
  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", () => {
      if (confirm("Clear all chat messages?")) {
        chatBox.innerHTML = "";
        chatHistory = [];
        const initialMsg = document.createElement("div");
        initialMsg.classList.add("chat-message", "bot");
        const avatar = document.createElement("div");
        avatar.classList.add("message-avatar");
        avatar.textContent = "🤖";
        initialMsg.appendChild(avatar);
        const content = document.createElement("div");
        content.classList.add("message-content");
        const p = document.createElement("p");
        p.textContent = "👋 Chat cleared! Ready for new questions.";
        content.appendChild(p);
        initialMsg.appendChild(content);
        chatBox.appendChild(initialMsg);
        showToast("Chat cleared successfully!", "success");
      }
    });
  }

  // File input change
  if (pdfFile) {
    pdfFile.addEventListener("change", () => {
      const file = pdfFile.files[0];
      if (file) {
        const fileName = file.name;
        console.log("Selected file:", fileName);

        // Show file selected state
        const fileDropZone = document.getElementById("fileDropZone");
        const fileDropContent =
          fileDropZone?.querySelector(".file-drop-content");
        const fileSelected = document.getElementById("fileSelected");
        const fileNameSpan = document.getElementById("fileName");

        if (fileDropContent && fileSelected && fileNameSpan) {
          fileDropContent.style.display = "none";
          fileSelected.style.display = "flex";
          fileNameSpan.textContent = fileName;
        }
      }
    });
  }

  // File drop zone functionality
  const fileDropZone = document.getElementById("fileDropZone");
  if (fileDropZone) {
    // Prevent default drag behaviors
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      fileDropZone.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when dragging over
    ["dragenter", "dragover"].forEach((eventName) => {
      fileDropZone.addEventListener(
        eventName,
        () => {
          fileDropZone.classList.add("drag-over");
        },
        false,
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      fileDropZone.addEventListener(
        eventName,
        () => {
          fileDropZone.classList.remove("drag-over");
        },
        false,
      );
    });

    // Handle dropped files
    fileDropZone.addEventListener(
      "drop",
      (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
          pdfFile.files = files;
          // Trigger change event
          const event = new Event("change", { bubbles: true });
          pdfFile.dispatchEvent(event);
        }
      },
      false,
    );

    // Click to browse
    fileDropZone.addEventListener("click", (e) => {
      if (!e.target.classList.contains("file-browse-btn")) {
        pdfFile.click();
      }
    });
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Mode toggle button
  if (modeToggle) {
    modeToggle.addEventListener("click", handleModeToggle);
  }

  // Check server status
  checkServerStatus();
  updateDocumentStats();
  loadAvailableTopics();
  loadAvailableTopicsForAssessment();
  initDashboard();
  updateDashboardView();
  updateAnalyticsView();
}

/* ===========================
   Tab Navigation
   =========================== */

function switchTab(e) {
  // Use currentTarget to get the button element, not the child element that was clicked
  const button = e.currentTarget || e.target;
  let tabName = button.dataset.tab;

  // If tabName is undefined, try to find it from parent button
  if (!tabName) {
    const parentButton = button.closest(".nav-button");
    if (parentButton) {
      tabName = parentButton.dataset.tab;
    }
  }

  if (!tabName) {
    console.error("Tab name not found");
    return;
  }

  // Remove active class from all buttons and tabs
  navButtons.forEach((btn) => btn.classList.remove("active"));
  tabs.forEach((tab) => tab.classList.remove("active"));

  // Add active class to clicked button and corresponding tab
  button.classList.add("active");
  const targetTab = document.getElementById(tabName + "Tab");
  if (!targetTab) {
    console.error("Target tab not found:", tabName);
    return;
  }

  targetTab.classList.add("active");
  currentTab = tabName;

  // Update document stats when switching to documents tab
  if (tabName === "documents") {
    loadDocuments();
  }

  // Load topics when switching to MCQ tab
  if (tabName === "mcq") {
    loadAvailableTopics();
  }

  // Load topics when switching to assessment tab
  if (tabName === "assessment") {
    loadAvailableTopicsForAssessment();
  }

  // Refresh analytics when switching to analytics tab
  if (tabName === "analytics") {
    showAnalyticsSkeleton();
    setTimeout(() => updateAnalyticsView(), 120);
  }
}

/* ===========================
   PDF Upload Handler
   =========================== */

async function handleUploadPDF() {
  const file = pdfFile.files[0];
  const categorySelect = document.getElementById("categorySelect");
  const category = categorySelect ? categorySelect.value : "General";

  // Validation
  if (!file) {
    showToast("Please select a PDF file", "error");
    return;
  }

  if (file.type !== "application/pdf") {
    showToast("Please select a valid PDF file", "error");
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    showToast("File size must be less than 50 MB", "error");
    return;
  }

  // Create FormData
  const formData = new FormData();
  formData.append("pdf_file", file);
  formData.append("category", category);

  showLoading(true);
  updateUploadStatus("Uploading PDF...", "loading");

  try {
    const response = await fetch(`${API_BASE_URL}/upload-pdf`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      updateUploadStatus(
        `✅ ${data.message || "PDF uploaded successfully!"}`,
        "success",
      );
      showToast("PDF uploaded successfully!", "success");
      recordActivity(`Uploaded ${file.name}`);

      // Reset form
      pdfFile.value = "";

      // Reset file display
      const fileDropZone = document.getElementById("fileDropZone");
      const fileDropContent = fileDropZone.querySelector(".file-drop-content");
      const fileSelected = document.getElementById("fileSelected");
      if (fileDropContent && fileSelected) {
        fileDropContent.style.display = "flex";
        fileSelected.style.display = "none";
      }

      // Update stats and refresh topics
      setTimeout(() => {
        updateDocumentStats();
        loadAvailableTopics(); // Refresh MCQ topics
        loadAvailableTopicsForAssessment(); // Refresh assessment topics
        clearUploadStatus();
      }, 2000);
    } else {
      updateUploadStatus(`❌ Error: ${data.error}`, "error");
      showToast("Error uploading PDF: " + data.error, "error");
    }
  } catch (error) {
    console.error("Upload error:", error);
    updateUploadStatus(`❌ Error: ${error.message}`, "error");
    showToast("Failed to upload PDF", "error");
  } finally {
    showLoading(false);
  }
}

/* ===========================
   Chat Handler
   =========================== */

async function handleSendQuestion() {
  const question = questionInput.value.trim();
  const chatTopic = document.getElementById("chatTopic");
  const selectedTopic = chatTopic ? chatTopic.value : "";

  if (!question) {
    showToast("Please enter a question", "error");
    return;
  }

  // Add user message to chat
  addChatMessage(question, "user");
  questionInput.value = "";

  // Add to chat history
  chatHistory.push({ role: "user", content: question });

  showLoading(true);

  // Show typing indicator
  const typingId = addTypingIndicator();

  try {
    // Build the API request with topic context if available
    const requestBody = {
      question: question,
      chat_history: chatHistory,
    };

    // Add topic context to the question if custom topic is selected
    if (selectedTopic) {
      requestBody.question = `[About ${selectedTopic}] ${question}`;
    }

    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    // Remove typing indicator
    removeTypingIndicator(typingId);

    if (response.ok) {
      const answer = data.answer || "No answer found";
      addChatMessage(answer, "bot");
      chatHistory.push({ role: "bot", content: answer });

      // Show follow-up suggestions
      showFollowUpSuggestions(question);

      // Record the interaction
      recordActivity(`Asked: ${question.substring(0, 40)}...`);
    } else {
      const errorMsg = data.error || "Failed to get answer";
      addChatMessage(errorMsg, "bot");
    }
  } catch (error) {
    console.error("Chat error:", error);
    removeTypingIndicator(typingId);
    addChatMessage(
      "Sorry, I encountered an error. Please check if the server is running.",
      "bot",
    );
  } finally {
    showLoading(false);
  }
}

function addChatMessage(message, role) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("chat-message", role);

  // Add avatar for bot messages
  if (role === "bot") {
    const avatar = document.createElement("div");
    avatar.classList.add("message-avatar");
    avatar.textContent = "🤖";
    messageDiv.appendChild(avatar);
  }

  const contentDiv = document.createElement("div");
  contentDiv.classList.add("message-content");

  const p = document.createElement("p");
  p.textContent = message;
  contentDiv.appendChild(p);

  // Add timestamp
  const timestamp = document.createElement("div");
  timestamp.classList.add("message-timestamp");
  const now = new Date();
  const timeString = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  timestamp.textContent = timeString;
  contentDiv.appendChild(timestamp);

  // Add copy button for bot messages
  if (role === "bot") {
    const copyBtn = document.createElement("button");
    copyBtn.classList.add("copy-btn");
    copyBtn.textContent = "📋 Copy";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(message);
      copyBtn.textContent = "✅ Copied!";
      setTimeout(() => {
        copyBtn.textContent = "📋 Copy";
      }, 2000);
    };
    contentDiv.appendChild(copyBtn);
  }

  messageDiv.appendChild(contentDiv);
  chatBox.appendChild(messageDiv);

  // Scroll to bottom
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Typing indicator functions
function addTypingIndicator() {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("chat-message", "bot");
  messageDiv.id = "typing-indicator";

  const avatar = document.createElement("div");
  avatar.classList.add("message-avatar");
  avatar.textContent = "🤖";
  messageDiv.appendChild(avatar);

  const contentDiv = document.createElement("div");
  contentDiv.classList.add("typing-indicator");

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.classList.add("typing-dot");
    contentDiv.appendChild(dot);
  }

  messageDiv.appendChild(contentDiv);
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  return "typing-indicator";
}

function removeTypingIndicator(id) {
  const typingElement = document.getElementById(id);
  if (typingElement) {
    typingElement.remove();
  }
}

// Follow-up suggestions
function showFollowUpSuggestions(lastQuestion) {
  const followUpContainer = document.getElementById("followUpSuggestions");
  const followUpButtons = document.getElementById("followUpButtons");

  if (!followUpContainer) return;

  // Generate follow-up suggestions based on the last question
  const suggestions = generateFollowUpQuestions(lastQuestion);

  followUpButtons.innerHTML = "";
  suggestions.forEach((suggestion) => {
    const btn = document.createElement("button");
    btn.classList.add("suggestion-btn");
    btn.textContent = suggestion;
    btn.onclick = () => {
      questionInput.value = suggestion;
      handleSendQuestion();
    };
    followUpButtons.appendChild(btn);
  });

  followUpContainer.style.display = "block";
  setTimeout(() => {
    followUpContainer.style.display = "none";
  }, 15000); // Hide after 15 seconds
}

function generateFollowUpQuestions(question) {
  const suggestions = [
    "Can you explain this in simpler terms?",
    "Give me an example",
    "What are the key points?",
    "How does this relate to...?",
    "Tell me more about this",
  ];

  return suggestions.slice(0, 3);
}

/* ===========================
   MCQ Generation Handler
   =========================== */

async function handleGenerateMCQ() {
  console.log("🔥 === handleGenerateMCQ called ===");
  console.log("Button clicked!");
  if (!mcqTopic || !numQuestions || !difficulty) {
    showToast("MCQ form is not ready. Please refresh the page.", "error");
    return;
  }

  const topicFromDropdown = mcqTopic.value.trim();
  console.log("Topic from dropdown:", topicFromDropdown);

  const customTopicInput = document.getElementById("customTopic");
  const customTopic = customTopicInput ? customTopicInput.value.trim() : "";
  console.log("Custom topic input:", customTopic);

  const topic = customTopic || topicFromDropdown;
  console.log("Final topic to use:", topic);

  const numQ = parseInt(numQuestions.value);
  const diff = difficulty.value;
  mcqExamModeEnabled = !!mcqExamMode?.checked;
  currentMcqTopic = topic;

  console.log("Topic:", topic, "NumQ:", numQ, "Difficulty:", diff);

  if (!topic) {
    console.warn("No topic selected");
    showToast(
      "Please select a topic from the list or enter a custom topic",
      "error",
    );
    return;
  }

  if (numQ < 1 || numQ > 25 || isNaN(numQ)) {
    console.error("Invalid question count");
    showToast("Please enter a valid number between 1 and 25", "error");
    return;
  }

  showMcqSkeleton();
  console.log("All validation passed, showing loading...");
  showLoading(true);
  console.log("Generating MCQs for topic:", { topic, numQ, diff });

  try {
    const requestBody = {
      topic,
      num_questions: numQ,
      difficulty: diff,
    };
    console.log("Request body:", requestBody);
    console.log("API URL:", `${API_BASE_URL}/generate-mcqs`);

    const response = await fetch(`${API_BASE_URL}/generate-mcqs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("✅ Response received!");
    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    const data = await response.json();
    console.log("✅ JSON parsed successfully!");
    console.log("Response data:", data);
    console.log("MCQs array:", data.mcqs);
    console.log("MCQs length:", data.mcqs ? data.mcqs.length : "undefined");

    if (response.ok && data.mcqs && data.mcqs.length > 0) {
      console.log(
        "✅ Success! Calling displayMCQs with",
        data.mcqs.length,
        "questions",
      );
      displayMCQs(data.mcqs);
      showToast(
        `Generated ${data.count} MCQs on "${topic}" successfully!`,
        "success",
      );
      updateMCQStats(topic, data.count);
    } else if (response.ok) {
      console.warn("Response OK but no MCQs:", data);
      showToast(
        "No MCQs generated. " + (data.error || "Unknown error"),
        "error",
      );
    } else {
      console.error("Response not OK:", response.status);
      showToast("Error generating MCQs: " + data.error, "error");
    }
  } catch (error) {
    console.error("❌ MCQ generation error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    showToast("Failed to generate MCQs: " + error.message, "error");
  } finally {
    console.log("Hiding loading indicator");
    showLoading(false);
  }
}

// Make handleGenerateMCQ available globally for onclick handler
window.handleGenerateMCQ = handleGenerateMCQ;

let currentMCQIndex = 0;
let mcqAnswers = {};
let mcqExamModeEnabled = false;
let currentMcqTopic = "";

let isServerOnline = true;

function displayMCQs(mcqs) {
  console.log("displayMCQs called with:", mcqs);
  console.log("mcqResult element:", mcqResult);

  if (!mcqResult) {
    console.error("mcqResult element not found!");
    return;
  }

  mcqResult.innerHTML = "";
  currentMCQIndex = 0;
  mcqAnswers = {};

  if (!mcqs || mcqs.length === 0) {
    console.warn("No MCQs provided");
    mcqResult.innerHTML = '<p class="empty-state">No MCQs generated</p>';
    return;
  }

  console.log("About to show first MCQ question");
  showMCQQuestion(mcqs, 0);
}

function showMCQQuestion(mcqs, index) {
  console.log(
    "showMCQQuestion called with index:",
    index,
    "Total MCQs:",
    mcqs ? mcqs.length : 0,
  );

  if (!mcqs || !mcqs[index]) {
    console.error("Invalid MCQ data at index:", index);
    return;
  }

  const mcq = mcqs[index];
  console.log("Current MCQ:", mcq);

  mcqResult.innerHTML = "";

  // Header with progress
  const header = document.createElement("div");
  header.style.cssText =
    "margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid rgba(148, 163, 184, 0.35); color: #f1f5f9;";
  header.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="margin: 0; color: #f1f5f9;">Question ${index + 1} of ${mcqs.length}</h3>
            <span style="background: rgba(30, 41, 59, 0.85); color: #f8fafc; border: 1px solid rgba(148, 163, 184, 0.45); padding: 5px 12px; border-radius: 20px; font-size: 13px; font-weight: bold;">
                ${mcq.difficulty.charAt(0).toUpperCase() + mcq.difficulty.slice(1)}
            </span>
        </div>
          <div style="background: rgba(51, 65, 85, 0.6); height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #f97316 0%, #ef4444 100%); height: 100%; width: ${((index + 1) / mcqs.length) * 100}%;"></div>
        </div>
    `;
  mcqResult.appendChild(header);
  console.log("Header appended");

  // Question text
  const questionDiv = document.createElement("div");
  questionDiv.style.cssText =
    "margin: 25px 0; font-size: 18px; font-weight: 500; line-height: 1.6; color: #e2e8f0;";
  questionDiv.textContent = mcq.question;
  mcqResult.appendChild(questionDiv);

  // Options (radio buttons)
  const optionsDiv = document.createElement("div");
  optionsDiv.style.cssText = "margin: 25px 0;";

  mcq.options.forEach((option, optIndex) => {
    const label = document.createElement("label");
    label.style.cssText =
      "display: flex; align-items: center; margin: 15px 0; padding: 12px; border: 1px solid rgba(148, 163, 184, 0.45); border-radius: 8px; cursor: pointer; transition: all 0.3s; background: rgba(15, 23, 42, 0.55);";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = `mcq_${index}`;
    radio.value = String.fromCharCode(65 + optIndex);
    radio.style.cssText =
      "width: 18px; height: 18px; margin-right: 12px; cursor: pointer;";

    const optionText = document.createElement("span");
    optionText.textContent = option;
    optionText.style.cssText = "flex: 1; font-size: 15px; color: #e2e8f0;";

    label.appendChild(radio);
    label.appendChild(optionText);

    label.addEventListener("mouseover", () => {
      label.style.backgroundColor = "rgba(30, 41, 59, 0.9)";
      label.style.borderColor = "#93c5fd";
    });
    label.addEventListener("mouseout", () => {
      label.style.backgroundColor = "rgba(15, 23, 42, 0.55)";
      label.style.borderColor = "rgba(148, 163, 184, 0.45)";
    });

    optionsDiv.appendChild(label);
  });
  mcqResult.appendChild(optionsDiv);

  // Submit and Navigation buttons
  const buttonsDiv = document.createElement("div");
  buttonsDiv.style.cssText =
    "display: flex; gap: 10px; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(148, 163, 184, 0.35);";

  if (index > 0 && !mcqExamModeEnabled) {
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "← Previous";
    prevBtn.style.cssText =
      "padding: 10px 20px; background: rgba(30, 41, 59, 0.8); color: #f1f5f9; border: 1px solid rgba(148, 163, 184, 0.45); border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: 500;";
    prevBtn.addEventListener("click", () => {
      saveAnswer(index, mcqs);
      showMCQQuestion(mcqs, index - 1);
    });
    buttonsDiv.appendChild(prevBtn);
  }

  const submitBtn = document.createElement("button");
  submitBtn.textContent = index === mcqs.length - 1 ? "Submit" : "Next";
  submitBtn.style.cssText =
    "flex: 1; padding: 12px 20px; background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 15px; font-weight: 600;";
  submitBtn.addEventListener("click", () => {
    const selected = document.querySelector(
      `input[name="mcq_${index}"]:checked`,
    );
    if (!selected) {
      showToast("Please select an answer", "error");
      return;
    }

    saveAnswer(index, mcqs);

    if (index === mcqs.length - 1) {
      showResults(mcqs, currentMcqTopic);
    } else {
      showMCQQuestion(mcqs, index + 1);
    }
  });
  buttonsDiv.appendChild(submitBtn);

  mcqResult.appendChild(buttonsDiv);
  console.log(
    "MCQ question fully rendered - mcqResult HTML length:",
    mcqResult.innerHTML.length,
  );
  console.log(
    "mcqResult element visibility:",
    window.getComputedStyle(mcqResult).display,
  );
}

function saveAnswer(index, mcqs) {
  const selected = document.querySelector(`input[name="mcq_${index}"]:checked`);
  if (selected) {
    mcqAnswers[index] = selected.value;
  }
}

function showResults(mcqs, topic) {
  mcqResult.innerHTML = "";

  let correct = 0;
  let incorrect = 0;

  // Calculate score
  mcqs.forEach((mcq, index) => {
    if (mcqAnswers[index] === mcq.correct_answer) {
      correct++;
    } else {
      incorrect++;
    }
  });

  const percentage = Math.round((correct / mcqs.length) * 100);

  // Score card
  const scoreCard = document.createElement("div");
  scoreCard.style.cssText =
    "background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white; padding: 40px; border-radius: 10px; text-align: center; margin-bottom: 30px;";
  scoreCard.innerHTML = `
        <h2 style="font-size: 28px; margin: 0 0 10px 0;">Test Complete!</h2>
        <div style="font-size: 48px; font-weight: bold; margin: 20px 0;">${percentage}%</div>
        <div style="font-size: 18px; margin: 10px 0;">Score: ${correct}/${mcqs.length} correct</div>
    `;
  mcqResult.appendChild(scoreCard);

  updateTopicStats(topic, correct, mcqs.length);

  if (!mcqExamModeEnabled) {
    // Review answers
    const reviewTitle = document.createElement("div");
    reviewTitle.style.cssText =
      "font-size: 20px; font-weight: bold; margin: 30px 0 20px 0; color: #333;";
    reviewTitle.textContent = "Review Your Answers";
    mcqResult.appendChild(reviewTitle);

    mcqs.forEach((mcq, index) => {
      const isCorrect = mcqAnswers[index] === mcq.correct_answer;
      const reviewDiv = document.createElement("div");
      reviewDiv.style.cssText = `padding: 15px; margin-bottom: 15px; border-left: 4px solid ${isCorrect ? "#4caf50" : "#f44336"}; background: ${isCorrect ? "#f1f8f6" : "#fef5f5"}; border-radius: 5px;`;

      const number = document.createElement("div");
      number.style.cssText =
        "font-weight: bold; color: #333; margin-bottom: 8px;";
      number.innerHTML = `Q${index + 1}: ${isCorrect ? "✅ Correct" : "❌ Incorrect"}`;

      const questionText = document.createElement("div");
      questionText.style.cssText =
        "font-size: 14px; color: #555; margin-bottom: 8px;";
      questionText.textContent = mcq.question;

      const answerInfo = document.createElement("div");
      answerInfo.style.cssText =
        "font-size: 13px; color: #666; margin-bottom: 5px;";
      answerInfo.innerHTML = `<strong>Your answer:</strong> ${mcq.options[mcqAnswers[index].charCodeAt(0) - 65]}<br>`;
      if (!isCorrect) {
        answerInfo.innerHTML += `<strong>Correct answer:</strong> ${mcq.options[mcq.correct_answer.charCodeAt(0) - 65]}<br>`;
      }

      const explanation = document.createElement("div");
      explanation.style.cssText =
        "font-size: 13px; color: #555; margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 3px;";
      explanation.innerHTML = `<strong>💡 Explanation:</strong> ${mcq.explanation}`;

      reviewDiv.appendChild(number);
      reviewDiv.appendChild(questionText);
      reviewDiv.appendChild(answerInfo);
      reviewDiv.appendChild(explanation);
      mcqResult.appendChild(reviewDiv);
    });
  }

  // Retry button
  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Export Results (CSV)";
  exportBtn.style.cssText =
    "width: 100%; padding: 12px; margin-top: 20px; background: #fff; color: #b91c1c; border: 2px solid #ef4444; border-radius: 5px; cursor: pointer; font-size: 15px; font-weight: 700;";
  exportBtn.addEventListener("click", () => {
    exportMCQResults(mcqs, topic);
  });
  mcqResult.appendChild(exportBtn);

  const retryBtn = document.createElement("button");
  retryBtn.textContent = "Generate New Questions";
  retryBtn.style.cssText =
    "width: 100%; padding: 12px; margin-top: 12px; background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 15px; font-weight: 600;";
  retryBtn.addEventListener("click", () => {
    document.querySelector('[data-tab="mcq"]').click();
    mcqResult.innerHTML = "";
  });
  mcqResult.appendChild(retryBtn);
}

function exportMCQResults(mcqs, topic) {
  const rows = [
    ["Topic", topic || ""],
    ["Total", mcqs.length],
    [],
    ["Question", "Selected", "Correct", "IsCorrect"],
  ];

  mcqs.forEach((mcq, index) => {
    const selected = mcqAnswers[index];
    const selectedText = selected
      ? mcq.options[selected.charCodeAt(0) - 65]
      : "";
    const correctText = mcq.options[mcq.correct_answer.charCodeAt(0) - 65];
    const isCorrect = selected === mcq.correct_answer ? "Yes" : "No";
    rows.push([mcq.question, selectedText, correctText, isCorrect]);
  });

  downloadCSV(`mcq-results-${Date.now()}.csv`, rows);
}

function exportAssessmentResults() {
  const total = assessmentQuestions.length;
  let correct = 0;
  assessmentQuestions.forEach((q, idx) => {
    if (assessmentAnswers[idx]?.isCorrect) correct++;
  });
  const percentage = total ? Math.round((correct / total) * 100) : 0;

  const rows = [
    ["Topic", assessmentCurrentTopic || ""],
    ["Score", `${correct}/${total}`],
    ["Percentage", `${percentage}%`],
    [],
    ["Question", "Selected", "Correct", "IsCorrect"],
  ];

  assessmentQuestions.forEach((q, idx) => {
    const selected = assessmentAnswers[idx]?.selected || "";
    const selectedText = selected ? q.options[selected.charCodeAt(0) - 65] : "";
    const correctText = q.options[q.correct_answer.charCodeAt(0) - 65];
    const isCorrect = selected === q.correct_answer ? "Yes" : "No";
    rows.push([q.question, selectedText, correctText, isCorrect]);
  });

  downloadCSV(`assessment-results-${Date.now()}.csv`, rows);
}

function downloadCSV(filename, rows) {
  const escapeCell = (value) => {
    const str = String(value ?? "");
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function showDocumentsSkeleton() {
  const docsList = document.getElementById("documentsList");
  if (!docsList) return;
  docsList.innerHTML = `
    <div class="skeleton-doc-grid">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;
}

function showAnalyticsSkeleton() {
  if (!analyticsList) return;
  analyticsList.innerHTML = `
    <div class="skeleton-analytics-stack">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>
  `;
}

function showMcqSkeleton() {
  if (!mcqResult) return;
  mcqResult.innerHTML = `
    <div class="skeleton-mcq-wrap">
      <div class="skeleton-line skeleton-line-lg"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>
  `;
}

/* ===========================
   Documents Management
   =========================== */

async function loadDocuments() {
  const docsList = document.getElementById("documentsList");
  showDocumentsSkeleton();
  showLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/documents`);
    const data = await response.json();

    if (!docsList) {
      showToast("Documents view not found", "error");
      return;
    }

    docsList.innerHTML = "";

    if (!data.documents || data.documents.length === 0) {
      docsList.innerHTML = `
                <p class="empty-state">
                    <span class="empty-icon">📂</span>
                    <span class="empty-text">No documents uploaded yet. Start by uploading your first PDF!</span>
                </p>
            `;
    } else {
      data.documents.forEach((doc) => {
        const card = document.createElement("div");
        card.classList.add("document-card");

        card.innerHTML = `
                    <div class="document-header">
                        <div class="document-title-section">
                            <span class="document-icon">📄</span>
                            <h3 class="document-name">${doc.name}</h3>
                        </div>
                        <div class="document-actions">
                            <button class="btn-view-document" title="View Document" data-filename="${doc.name}" onclick="viewDocument(this.getAttribute('data-filename'))">👁️</button>
                            <button class="btn-delete-document" title="Delete Document" data-filename="${doc.name}" onclick="deleteDocument(this.getAttribute('data-filename'))">🗑️</button>
                        </div>
                    </div>
                    <div class="document-info">
                        <div class="doc-info-item">
                            <span class="doc-info-label">Category</span>
                            <span class="doc-info-value">${doc.category}</span>
                        </div>
                        <div class="doc-info-item">
                            <span class="doc-info-label">Chunks</span>
                            <span class="doc-info-value">${doc.chunks}</span>
                        </div>
                        <div class="doc-info-item">
                            <span class="doc-info-label">Size</span>
                            <span class="doc-info-value">${formatBytes(doc.size)}</span>
                        </div>
                    </div>
                `;

        docsList.appendChild(card);
      });
    }

    const cache = getOfflineCache();
    cache.documents = data.documents || [];
    saveOfflineCache(cache);

    updateDocumentStats();
  } catch (error) {
    console.error("Error loading documents:", error);
    const cache = getOfflineCache();
    if (cache.documents && cache.documents.length) {
      docsList.innerHTML = "";
      cache.documents.forEach((doc) => {
        const card = document.createElement("div");
        card.classList.add("document-card");
        card.innerHTML = `
                    <div class="document-header">
                        <div class="document-title-section">
                            <span class="document-icon">📄</span>
                            <h3 class="document-name">${doc.name}</h3>
                        </div>
                        <div class="document-actions">
                            <button class="btn-view-document" title="View Document" data-filename="${doc.name}" onclick="viewDocument(this.getAttribute('data-filename'))">👁️</button>
                            <button class="btn-delete-document" title="Delete Document" data-filename="${doc.name}" onclick="deleteDocument(this.getAttribute('data-filename'))">🗑️</button>
                        </div>
                    </div>
                    <div class="document-info">
                        <div class="doc-info-item">
                            <span class="doc-info-label">Category</span>
                            <span class="doc-info-value">${doc.category}</span>
                        </div>
                        <div class="doc-info-item">
                            <span class="doc-info-label">Chunks</span>
                            <span class="doc-info-value">${doc.chunks}</span>
                        </div>
                        <div class="doc-info-item">
                            <span class="doc-info-label">Size</span>
                            <span class="doc-info-value">${formatBytes(doc.size)}</span>
                        </div>
                    </div>
                `;
        docsList.appendChild(card);
      });
      showToast("Offline: showing cached documents", "warning");
    } else {
      showToast("Failed to load documents", "error");
    }
  } finally {
    showLoading(false);
  }
}

async function handleClearDatabase() {
  if (
    !confirm(
      "Are you sure you want to clear all uploaded documents? This action cannot be undone.",
    )
  ) {
    return;
  }

  showLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/clear-database`, {
      method: "POST",
    });

    const data = await response.json();

    if (response.ok) {
      showToast("Database cleared successfully!", "success");
      recordActivity("Database cleared");
      chatHistory = [];
      updateDocumentStats();
      mcqResult.innerHTML = "";
    } else {
      showToast("Error clearing database: " + data.error, "error");
    }
  } catch (error) {
    console.error("Clear error:", error);
    showToast("Failed to clear database", "error");
  } finally {
    showLoading(false);
  }
}

async function updateDocumentStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/documents`);
    const data = await response.json();

    if (data.documents) {
      docCount.textContent = data.documents.length;
      const totalChunks = data.documents.reduce(
        (sum, doc) => sum + (doc.chunks || 0),
        0,
      );
      chunkCount.textContent = totalChunks;
      updateDashboardDocStats(data.documents.length, totalChunks);
      const cache = getOfflineCache();
      cache.documents = data.documents || [];
      saveOfflineCache(cache);
    }
  } catch (error) {
    console.error("Error updating stats:", error);
    const cache = getOfflineCache();
    if (cache.documents && cache.documents.length) {
      docCount.textContent = cache.documents.length;
      const totalChunks = cache.documents.reduce(
        (sum, doc) => sum + (doc.chunks || 0),
        0,
      );
      chunkCount.textContent = totalChunks;
      updateDashboardDocStats(cache.documents.length, totalChunks);
    }
  }
}

/* ===========================
   Dashboard Helpers
   =========================== */

const DASHBOARD_KEY = "dashboardStats";

function initDashboard() {
  if (!localStorage.getItem(DASHBOARD_KEY)) {
    const initial = {
      mcqGenerated: 0,
      mcqLastTopic: "—",
      mcqLastCount: 0,
      assessmentAttempts: 0,
      assessmentTotal: 0,
      assessmentAvg: 0,
      assessmentLastScore: "—",
      assessmentLastDate: "—",
      streakCurrent: 0,
      streakBest: 0,
      streakLastDate: null,
      recentActivity: [],
    };
    localStorage.setItem(DASHBOARD_KEY, JSON.stringify(initial));
  }
}

function getDashboardState() {
  try {
    const raw = localStorage.getItem(DASHBOARD_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function saveDashboardState(state) {
  localStorage.setItem(DASHBOARD_KEY, JSON.stringify(state));
}

function updateDashboardView() {
  const state = getDashboardState();

  const dashMcqCount = document.getElementById("dashMcqCount");
  const dashMcqTopic = document.getElementById("dashMcqTopic");
  const dashAssessAttempts = document.getElementById("dashAssessAttempts");
  const dashAssessAvg = document.getElementById("dashAssessAvg");
  const dashAssessLast = document.getElementById("dashAssessLast");
  const dashStreakCurrent = document.getElementById("dashStreakCurrent");
  const dashStreakBest = document.getElementById("dashStreakBest");

  if (dashMcqCount) dashMcqCount.textContent = state.mcqGenerated || 0;
  if (dashMcqTopic) dashMcqTopic.textContent = state.mcqLastTopic || "—";
  if (dashAssessAttempts)
    dashAssessAttempts.textContent = state.assessmentAttempts || 0;
  if (dashAssessAvg) {
    dashAssessAvg.textContent = state.assessmentAttempts
      ? `${state.assessmentAvg}%`
      : "—";
  }
  if (dashAssessLast) {
    dashAssessLast.textContent = state.assessmentAttempts
      ? `${state.assessmentLastScore}%`
      : "—";
  }
  if (dashStreakCurrent)
    dashStreakCurrent.textContent = state.streakCurrent || 0;
  if (dashStreakBest) dashStreakBest.textContent = state.streakBest || 0;

  renderRecentActivity(state.recentActivity || []);
}

function updateDashboardDocStats(documents, chunks) {
  const dashDocCount = document.getElementById("dashDocCount");
  const dashChunkCount = document.getElementById("dashChunkCount");
  if (dashDocCount) dashDocCount.textContent = documents;
  if (dashChunkCount) dashChunkCount.textContent = chunks;
}

function updateDashboardServerStatus(isOnline) {
  const dashServerStatus = document.getElementById("dashServerStatus");
  const dashServerHint = document.getElementById("dashServerHint");

  if (!dashServerStatus || !dashServerHint) return;

  dashServerStatus.classList.remove("online", "offline");
  if (isOnline) {
    dashServerStatus.textContent = "Online";
    dashServerStatus.classList.add("online");
    dashServerHint.textContent = "API reachable";
  } else {
    dashServerStatus.textContent = "Offline";
    dashServerStatus.classList.add("offline");
    dashServerHint.textContent = "Check backend server";
  }
}

function applyStreakUpdate(state) {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const lastKey = state.streakLastDate;

  if (!lastKey) {
    state.streakCurrent = 1;
    state.streakBest = Math.max(state.streakBest || 0, 1);
    state.streakLastDate = todayKey;
    return state;
  }

  if (lastKey === todayKey) {
    return state;
  }

  const lastDate = new Date(lastKey + "T00:00:00");
  const diffDays = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    state.streakCurrent = (state.streakCurrent || 0) + 1;
  } else {
    state.streakCurrent = 1;
  }

  state.streakBest = Math.max(state.streakBest || 0, state.streakCurrent);
  state.streakLastDate = todayKey;
  return state;
}

function recordActivity(message) {
  let state = getDashboardState();
  state = applyStreakUpdate(state);
  const entry = {
    message,
    time: new Date().toISOString(),
  };
  state.recentActivity = [entry, ...(state.recentActivity || [])].slice(0, 6);
  saveDashboardState(state);
  renderRecentActivity(state.recentActivity);
  updateDashboardView();
}

function renderRecentActivity(items) {
  const list = document.getElementById("dashActivityList");
  if (!list) return;

  if (!items || items.length === 0) {
    list.innerHTML = '<li class="activity-item">No activity yet</li>';
    return;
  }

  list.innerHTML = items
    .map((item) => {
      const time = new Date(item.time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `<li class="activity-item">${item.message}<span>${time}</span></li>`;
    })
    .join("");
}

function updateMCQStats(topic, count) {
  const state = getDashboardState();
  const safeCount = Number(count) || 0;
  state.mcqGenerated = (state.mcqGenerated || 0) + safeCount;
  state.mcqLastTopic = topic || "—";
  state.mcqLastCount = safeCount;
  saveDashboardState(state);
  updateDashboardView();
  recordActivity(`MCQ: ${safeCount} on ${topic}`);
}

function updateAssessmentStats(scorePercent) {
  const state = getDashboardState();
  const score = Number(scorePercent) || 0;
  state.assessmentAttempts = (state.assessmentAttempts || 0) + 1;
  state.assessmentTotal = (state.assessmentTotal || 0) + score;
  state.assessmentAvg = Math.round(
    state.assessmentTotal / state.assessmentAttempts,
  );
  state.assessmentLastScore = score;
  state.assessmentLastDate = new Date().toLocaleDateString();
  saveDashboardState(state);
  updateDashboardView();
  recordActivity(`Assessment: ${score}%`);
}

const TOPIC_STATS_KEY = "topicStats";
const LEADERBOARD_KEY = "leaderboardScores";
const OFFLINE_CACHE_KEY = "offlineCache";

function getTopicStats() {
  try {
    const raw = localStorage.getItem(TOPIC_STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function saveTopicStats(stats) {
  localStorage.setItem(TOPIC_STATS_KEY, JSON.stringify(stats));
}

function getOfflineCache() {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function saveOfflineCache(cache) {
  localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(cache));
}

function getLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveLeaderboard(items) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(items));
}

function updateLeaderboard(scorePercent, topic) {
  const entry = {
    score: Number(scorePercent) || 0,
    topic: topic || "—",
    date: new Date().toLocaleDateString(),
  };

  const leaderboard = getLeaderboard();
  leaderboard.push(entry);
  leaderboard.sort((a, b) => b.score - a.score);
  const trimmed = leaderboard.slice(0, 5);
  saveLeaderboard(trimmed);
  updateAnalyticsView();
}

function updateTopicStats(topic, correct, total) {
  if (!topic) return;
  const stats = getTopicStats();
  if (!stats[topic]) {
    stats[topic] = { correct: 0, total: 0, attempts: 0, lastScore: 0 };
  }

  stats[topic].correct += correct;
  stats[topic].total += total;
  stats[topic].attempts += 1;
  stats[topic].lastScore = Math.round((correct / total) * 100);

  saveTopicStats(stats);
  updateAnalyticsView();
}

function updateAnalyticsView() {
  if (!analyticsList) return;
  const stats = getTopicStats();
  const entries = Object.entries(stats);
  const leaderboard = getLeaderboard();

  const state = getDashboardState();
  const analyticsMcqTotal = document.getElementById("analyticsMcqTotal");
  const analyticsAssessAvg = document.getElementById("analyticsAssessAvg");
  const analyticsStreak = document.getElementById("analyticsStreak");

  if (analyticsMcqTotal)
    analyticsMcqTotal.textContent = state.mcqGenerated || 0;
  if (analyticsAssessAvg) {
    analyticsAssessAvg.textContent = state.assessmentAttempts
      ? `${state.assessmentAvg}%`
      : "—";
  }
  if (analyticsStreak) {
    analyticsStreak.textContent = `${state.streakCurrent || 0} days`;
  }

  if (entries.length === 0) {
    analyticsList.innerHTML =
      '<div class="analytics-item">No topic data yet.</div>';
  } else {
    analyticsList.innerHTML = entries
      .map(([topic, data]) => {
        const accuracy = data.total
          ? Math.round((data.correct / data.total) * 100)
          : 0;
        return `
                    <div class="analytics-item">
                        <div class="analytics-item-header">
                            <span>${topic}</span>
                            <span>${accuracy}%</span>
                        </div>
                        <div class="analytics-bar">
                            <div class="analytics-bar-fill" style="width: ${accuracy}%;"></div>
                        </div>
                        <div class="dash-sub">Attempts: ${data.attempts} · Last: ${data.lastScore}%</div>
                    </div>
                `;
      })
      .join("");
  }

  renderHeatmap(entries);

  const leaderboardEl = document.getElementById("leaderboard");
  if (leaderboardEl) {
    if (!leaderboard.length) {
      leaderboardEl.innerHTML =
        '<div class="dash-title">Leaderboard</div><div class="analytics-item">No scores yet.</div>';
    } else {
      const items = leaderboard
        .map((item, idx) => {
          return `<div class="leaderboard-item">#${idx + 1} ${item.score}% · ${item.topic}<span>${item.date}</span></div>`;
        })
        .join("");
      leaderboardEl.innerHTML = `<div class="dash-title">Leaderboard</div>${items}`;
    }
  }
}

/* ===========================
   Server Status & Health
   =========================== */

async function checkServerStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      currentMode = data.mode || "online";
      ollamaAvailable = data.ollama_available || false;
      geminiAvailable = data.gemini_available || false;

      updateStatusIndicator(true);
      updateModeDisplay();

      // Show mode switcher if both modes available
      if (ollamaAvailable && geminiAvailable && modeSwitcher) {
        modeSwitcher.style.display = "block";
      }
    } else {
      updateStatusIndicator(false);
    }
  } catch (error) {
    console.error("Server not responding:", error);
    updateStatusIndicator(false);
  }
}

function updateModeDisplay() {
  if (!modeIcon || !modeText) return;

  if (currentMode === "offline") {
    modeIcon.textContent = "🔌";
    modeText.textContent = "Offline";
    modeToggle.title =
      "Currently in Offline mode (using Ollama). Click to switch to Online mode.";
  } else {
    modeIcon.textContent = "🌐";
    modeText.textContent = "Online";
    modeToggle.title =
      "Currently in Online mode (using Gemini). Click to switch to Offline mode.";
  }
}

async function handleModeToggle() {
  try {
    const newMode = currentMode === "online" ? "offline" : "online";

    // Show loading
    modeToggle.disabled = true;
    modeText.textContent = "Switching...";

    const response = await fetch(`${API_BASE_URL}/mode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: newMode }),
    });

    if (response.ok) {
      const data = await response.json();
      currentMode = data.mode;
      updateModeDisplay();
      showToast(`Switched to ${currentMode} mode`, "success");
    } else {
      const error = await response.json();
      showToast(error.error || "Failed to switch mode", "error");
    }
  } catch (error) {
    console.error("Error switching mode:", error);
    showToast("Error switching mode", "error");
  } finally {
    modeToggle.disabled = false;
  }
}

function updateStatusIndicator(isOnline) {
  if (!statusIndicator) return;

  const statusPulse = statusIndicator.querySelector(".status-pulse");
  const statusValue = statusIndicator.querySelector(".status-value");
  if (!statusPulse || !statusValue) return;

  isServerOnline = isOnline;

  if (isOnline) {
    statusPulse.style.background = "#10b981";
    statusPulse.style.boxShadow = "0 0 12px rgba(16, 185, 129, 0.6)";
    statusValue.textContent = "Online";
  } else {
    statusPulse.style.background = "#ef4444";
    statusPulse.style.boxShadow = "0 0 12px rgba(239, 68, 68, 0.6)";
    statusValue.textContent = "Offline";
  }

  updateDashboardServerStatus(isOnline);
}

/* ===========================
   UI Utilities
   =========================== */

function updateUploadStatus(message, type) {
  if (!uploadStatus) return;
  uploadStatus.textContent = message;
  uploadStatus.className = `upload-status ${type}`;
}

function clearUploadStatus() {
  if (!uploadStatus) return;
  uploadStatus.textContent = "";
  uploadStatus.className = "upload-status";
}

function showLoading(show) {
  if (!spinner) return;
  if (show) {
    spinner.classList.add("active");
  } else {
    spinner.classList.remove("active");
  }
}

function showToast(message, type = "info") {
  if (!toast) {
    console.log(`[${type}] ${message}`);
    return;
  }

  toast.textContent = message;
  toast.className = `toast ${type} active`;

  setTimeout(() => {
    toast.classList.remove("active");
  }, 3000);
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i)) + " " + sizes[i];
}

function viewDocument(filename) {
  if (!filename) {
    showToast("No filename provided", "error");
    return;
  }

  // Construct the URL to the document
  const documentUrl = `/uploads/${encodeURIComponent(filename)}`;

  // Open the document in a new tab
  const newWindow = window.open(documentUrl, "_blank");

  if (!newWindow) {
    showToast("Could not open document. Check if popups are blocked.", "error");
  } else {
    showToast("Opening document...", "success");
  }
}

async function loadAvailableTopics() {
  console.log("Loading available topics...");

  if (!mcqTopic) return;

  try {
    const response = await fetch(`${API_BASE_URL}/documents`);
    console.log("Documents API response:", response.status);
    const data = await response.json();
    console.log("Documents data:", data);

    if (!data.documents || data.documents.length === 0) {
      console.warn("No documents available");
      showToast("Please upload documents first to generate MCQs", "warning");
      mcqTopic.innerHTML =
        '<option value="">-- No documents uploaded --</option>';
      return;
    }

    // Clear existing options except the first one
    mcqTopic.innerHTML = '<option value="">-- Select a topic --</option>';

    // Get unique categories and filenames
    const topics = new Set();
    data.documents.forEach((doc) => {
      // Add category
      if (doc.category) {
        topics.add(doc.category);
      }
      // Add filename (without extension) as topic
      if (doc.name) {
        const filename = doc.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        topics.add(filename);
      }
    });

    // Sort topics alphabetically
    const sortedTopics = Array.from(topics).sort();

    // Add topics to dropdown
    sortedTopics.forEach((topic) => {
      const option = document.createElement("option");
      option.value = topic;
      option.textContent = topic;
      mcqTopic.appendChild(option);
    });

    console.log("Available topics loaded:", sortedTopics);
  } catch (error) {
    console.error("Error loading topics:", error);
    showToast("Failed to load available topics", "error");
  }
}

async function loadAvailableTopicsForFlashcards() {
  if (!flashTopic) return;

  try {
    const response = await fetch(`${API_BASE_URL}/documents`);
    const data = await response.json();

    if (!data.documents || data.documents.length === 0) {
      flashTopic.innerHTML =
        '<option value="">-- No documents uploaded --</option>';
      return;
    }

    flashTopic.innerHTML = '<option value="">-- Select a topic --</option>';

    const topics = new Set();
    data.documents.forEach((doc) => {
      if (doc.category) {
        topics.add(doc.category);
      }
      if (doc.name) {
        const filename = doc.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        topics.add(filename);
      }
    });

    Array.from(topics)
      .sort()
      .forEach((topic) => {
        const option = document.createElement("option");
        option.value = topic;
        option.textContent = topic;
        flashTopic.appendChild(option);
      });
  } catch (error) {
    console.error("Error loading flashcard topics:", error);
  }
}

async function deleteDocument(filename) {
  if (!filename) {
    showToast("No filename provided", "error");
    return;
  }

  // Confirm deletion
  if (
    !confirm(
      `Are you sure you want to delete "${filename}"? This action cannot be undone.`,
    )
  ) {
    return;
  }

  showLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/delete-document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: filename,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      showToast(`Document "${filename}" deleted successfully!`, "success");
      recordActivity(`Deleted ${filename}`);
      loadDocuments(); // Refresh the document list
      updateDocumentStats();
      loadAvailableTopics(); // Refresh MCQ topics
      loadAvailableTopicsForAssessment(); // Refresh assessment topics
    } else {
      showToast("Error deleting document: " + data.error, "error");
    }
  } catch (error) {
    console.error("Delete error:", error);
    showToast("Failed to delete document: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// Check server status periodically
setInterval(checkServerStatus, 30000);
/* ===========================
   ASSESSMENT TEST FEATURE
   =========================== */

let assessmentQuestions = [];
let assessmentAnswers = {}; // { questionId: { selected: 'A', isCorrect: true } }
let currentQuestionIndex = 0;
let assessmentStartTime = null;
let assessmentTestInterval = null;
let assessmentCurrentTopic = "";

// Setup Assessment Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  const startTestBtn = document.getElementById("startTestBtn");
  const submitTestBtn = document.getElementById("submitTestBtn");
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");

  if (startTestBtn) startTestBtn.addEventListener("click", handleStartTest);
  if (submitTestBtn) submitTestBtn.addEventListener("click", handleSubmitTest);
  if (nextBtn) nextBtn.addEventListener("click", handleNextQuestion);
  if (prevBtn) prevBtn.addEventListener("click", handlePreviousQuestion);

  // Load topics when switching to assessment tab
  if (navButtons && navButtons.length) {
    navButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const clicked = e.currentTarget || e.target;
        if (clicked?.dataset?.tab === "assessment") {
          loadAvailableTopicsForAssessment();
        }
      });
    });
  }
});

async function handleStartTest() {
  const topicFromDropdown = document
    .getElementById("assessmentTopic")
    .value.trim();
  const customAssessmentTopic = document.getElementById(
    "customAssessmentTopic",
  );
  const customTopic = customAssessmentTopic
    ? customAssessmentTopic.value.trim()
    : "";

  // Use custom topic if provided, otherwise use dropdown selection
  const topic = customTopic || topicFromDropdown;

  const numQ = parseInt(document.getElementById("assessmentQuestions").value);
  const diff = document.getElementById("assessmentDifficulty").value;

  if (!topic) {
    showToast("Please select a topic or enter a custom topic", "error");
    return;
  }

  assessmentCurrentTopic = topic;

  if (numQ < 5 || numQ > 50 || isNaN(numQ)) {
    showToast("Please enter questions between 5 and 50", "error");
    return;
  }

  showLoading(true);
  console.log("Starting test with:", { topic, numQ, diff });

  try {
    const response = await fetch(`${API_BASE_URL}/generate-mcqs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: topic,
        num_questions: numQ,
        difficulty: diff,
      }),
    });

    const data = await response.json();

    if (response.ok && data.count > 0) {
      assessmentQuestions = data.mcqs;
      assessmentAnswers = {};
      currentQuestionIndex = 0;
      assessmentStartTime = Date.now();

      // Hide setup, show test
      document.getElementById("assessmentSetup").style.display = "none";
      document.getElementById("assessmentContainer").style.display = "block";
      document.getElementById("assessmentResults").style.display = "none";

      // Start timer
      startTestTimer();

      // Load first question
      displayCurrentQuestion();
      showToast(`Test started! ${data.count} questions loaded.`, "success");
    } else {
      showToast("Error: " + (data.error || "No questions generated"), "error");
    }
  } catch (error) {
    console.error("Test start error:", error);
    showToast("Failed to start test: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

function displayCurrentQuestion() {
  if (currentQuestionIndex >= assessmentQuestions.length) {
    return;
  }

  const question = assessmentQuestions[currentQuestionIndex];
  const questionDiv = document.getElementById("assessmentQuestion");

  // Update progress
  const progress = (currentQuestionIndex / assessmentQuestions.length) * 100;
  document.getElementById("progressFill").style.width = progress + "%";
  document.getElementById("questionNumber").textContent =
    currentQuestionIndex + 1;
  document.getElementById("totalQuestions").textContent =
    assessmentQuestions.length;

  // Build question HTML
  let html = `
        <div class="mcq-card" style="animation: bounce-in 0.5s ease;">
            <div class="mcq-number" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); animation: bounce 0.5s ease;">
                ${currentQuestionIndex + 1}
            </div>
            <div class="mcq-question">${question.question}</div>
            <div class="mcq-options">
    `;

  question.options.forEach((option, idx) => {
    const letter = String.fromCharCode(65 + idx); // A, B, C, D
    const selected =
      assessmentAnswers[currentQuestionIndex]?.selected === letter;
    const classNames = ["mcq-option"];
    if (selected) classNames.push("selected");

    html += `
            <div class="${classNames.join(" ")}" onclick="selectAnswer(${currentQuestionIndex}, '${letter}')">
                ${option}
            </div>
        `;
  });

  html += `</div>`;

  questionDiv.innerHTML = html;

  // Update button states
  document.getElementById("prevBtn").disabled = currentQuestionIndex === 0;
  document.getElementById("nextBtn").disabled =
    currentQuestionIndex === assessmentQuestions.length - 1;
  document.getElementById("submitTestBtn").style.display =
    currentQuestionIndex === assessmentQuestions.length - 1
      ? "inline-block"
      : "none";
}

function selectAnswer(questionIndex, letter) {
  assessmentAnswers[questionIndex] = {
    selected: letter,
    isCorrect: assessmentQuestions[questionIndex].correct_answer === letter,
  };

  displayCurrentQuestion();
}

function handleNextQuestion() {
  if (currentQuestionIndex < assessmentQuestions.length - 1) {
    currentQuestionIndex++;
    displayCurrentQuestion();
  }
}

function handlePreviousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    displayCurrentQuestion();
  }
}

function startTestTimer() {
  let seconds = 0;
  assessmentTestInterval = setInterval(() => {
    seconds++;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    document.getElementById("timer").textContent = `⏱️ Time: ${mins}m ${secs}s`;
  }, 1000);
}

function handleSubmitTest() {
  submitTest();
}

function submitTest() {
  clearInterval(assessmentTestInterval);

  // Calculate score
  let correct = 0;
  let answered = 0;

  for (let i = 0; i < assessmentQuestions.length; i++) {
    if (assessmentAnswers[i]) {
      answered++;
      if (assessmentAnswers[i].isCorrect) {
        correct++;
      }
    }
  }

  const percentage = Math.round((correct / assessmentQuestions.length) * 100);
  const totalTime = Math.floor((Date.now() - assessmentStartTime) / 1000);
  const mins = Math.floor(totalTime / 60);
  const secs = totalTime % 60;

  // Display results
  updateAssessmentStats(percentage);
  updateTopicStats(assessmentCurrentTopic, correct, assessmentQuestions.length);
  updateLeaderboard(percentage, assessmentCurrentTopic);
  displayTestResults(correct, answered, percentage, mins, secs);
}

function displayTestResults(correct, answered, percentage, mins, secs) {
  const resultsDiv = document.getElementById("assessmentResults");

  // Determine performance level
  let performanceClass = "excellent";
  let performanceText = "🌟 Excellent Performance!";
  if (percentage < 50) {
    performanceClass = "poor";
    performanceText = "📚 Keep Practicing!";
  } else if (percentage < 70) {
    performanceClass = "average";
    performanceText = "👍 Good Job!";
  } else if (percentage < 90) {
    performanceClass = "good";
    performanceText = "🎉 Great Work!";
  }

  let html = `
        <div class="result-card ${performanceClass}">
            <h3>${performanceText}</h3>
            <div class="score-summary">
                <div class="score-item">
                    <span class="score-label">Score</span>
                    <span class="score-value">${correct}/${assessmentQuestions.length}</span>
                </div>
                <div class="score-item">
                    <span class="score-label">Percentage</span>
                    <span class="score-percentage">${percentage}%</span>
                </div>
                <div class="score-item">
                    <span class="score-label">Answered</span>
                    <span class="score-value">${answered}/${assessmentQuestions.length}</span>
                </div>
                <div class="score-item">
                    <span class="score-label">Duration</span>
                    <span class="score-value">${mins}m ${secs}s</span>
                </div>
            </div>

            <div class="result-actions">
                <button class="btn btn-primary" onclick="resetAssessment()">📝 Retake Test</button>
                <button class="btn" style="background: #fff; color: #b91c1c; border: 2px solid #ef4444;" onclick="exportAssessmentResults()">Export Results (CSV)</button>
                <button class="btn" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white;" onclick="switchTab({target: {dataset: {tab: 'upload'}}})">Back to Home</button>
            </div>
        </div>
    `;

  resultsDiv.innerHTML = html;

  // Hide test, show results
  document.getElementById("assessmentContainer").style.display = "none";
  document.getElementById("assessmentSetup").style.display = "none";
  document.getElementById("assessmentResults").style.display = "block";

  showToast(
    `Test submitted! Your score: ${correct}/${assessmentQuestions.length} (${percentage}%)`,
    "success",
  );
}

function resetAssessment() {
  assessmentQuestions = [];
  assessmentAnswers = {};
  currentQuestionIndex = 0;

  document.getElementById("assessmentSetup").style.display = "block";
  document.getElementById("assessmentContainer").style.display = "none";
  document.getElementById("assessmentResults").style.display = "none";

  showToast("Test reset. Ready for a new test!", "info");
}

async function loadAvailableTopicsForAssessment() {
  try {
    const response = await fetch(`${API_BASE_URL}/documents`);
    const data = await response.json();

    const select = document.getElementById("assessmentTopic");
    if (!select) return;

    // Clear existing options except the first placeholder
    while (select.options.length > 1) {
      select.remove(1);
    }

    if (data.documents && data.documents.length > 0) {
      // Extract document names as topics (same as MCQ topics)
      const topics = new Set();
      data.documents.forEach((doc) => {
        if (doc.name) {
          const filename = doc.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
          topics.add(filename);
        }
      });

      // Sort topics alphabetically and add to dropdown
      const sortedTopics = Array.from(topics).sort();
      sortedTopics.forEach((topic) => {
        const option = document.createElement("option");
        option.value = topic;
        option.textContent = topic;
        select.appendChild(option);
      });

      console.log("Assessment topics loaded:", sortedTopics);
    } else {
      showToast(
        "No documents uploaded yet. Please upload a PDF first.",
        "info",
      );
    }
  } catch (error) {
    console.error("Error loading topics:", error);
    showToast("Failed to load topics", "error");
  }
}

function renderHeatmap(entries) {
  const heatmapGrid = document.getElementById("heatmapGrid");
  if (!heatmapGrid) return;

  if (!entries.length) {
    heatmapGrid.innerHTML = '<div class="heatmap-cell">No data</div>';
    return;
  }

  heatmapGrid.innerHTML = entries
    .map(([topic, data]) => {
      const accuracy = data.total
        ? Math.round((data.correct / data.total) * 100)
        : 0;
      const color = getHeatmapColor(accuracy);
      return `
                <div class="heatmap-cell" style="background: ${color};">
                    ${topic}
                    <span>${accuracy}%</span>
                </div>
            `;
    })
    .join("");
}

function getHeatmapColor(percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  const lightness = 92 - clamped * 0.5;
  return `hsl(0, 85%, ${lightness}%)`;
}
