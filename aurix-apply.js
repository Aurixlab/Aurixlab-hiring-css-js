(function () {
  "use strict";

  /* ======================================================================
     THE ONE LINE TO EDIT AFTER DEPLOYING apps-script-doPost.gs.
     Paste the deployed Web App URL (it ends in /exec) between the quotes.
     ====================================================================== */
  var GOOGLE_SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzSALXlMapPPHeCsjH4Twu8St3nf6rVGJKTEXB9BbZL1s0_O-Rj1JI765YGp4jYrpIf/exec";

  var DRAFT_KEY_BASE = "axa_application_v2";
  var TOTAL_STEPS = 6;
  var MAX_LINKS = 3;

  var root = document.getElementById("axa");
  if (!root || root.dataset.axaReady) return;
  root.dataset.axaReady = "1";

  /* Which page is this? "home" has no form; "apply" carries one. */
  var pageEl = document.querySelector("[data-axa-page]");
  var PAGE = pageEl ? pageEl.dataset.axaPage : "home";
  var ROLE_SLUG = pageEl ? (pageEl.dataset.axaRoleSlug || "") : "";

  /* Reduced motion is resolved before any timeline or ScrollTrigger exists. */
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var MOTION = !!gsap && !REDUCED;
  if (gsap && ST && gsap.registerPlugin) { try { gsap.registerPlugin(ST); } catch (e) {} }

  var $ = function (s, c) { return (c || root).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || root).querySelectorAll(s)); };

  var form = $("#axa-form");
  var shell = $("[data-axa-shell]");
  var intro = $(".axa-intro");
  var done = $("[data-axa-done]");
  var live = $("#axa-live");
  var fillEl = $("[data-axa-fill]");
  var nodes = $$("[data-axa-goto]");
  var reviewEl = $("[data-axa-review]");
  var submitBtn = $("[data-axa-submit]");
  var submitLabel = $("[data-axa-submit-label]");
  var submitErr = $("[data-axa-submit-err]");

  var state = { step: 0, maxSeen: 1, sending: false };
  var HAS_FORM = !!form;

  /* ======================================================================
     ROLES. One entry per application page. The page selects its entry with
     data-axa-role-slug on the outer .axa-page element.

       label      goes into the "position" column in the Sheet
       sjt        the scenario set for that role, or null when not written yet

     To add a role: create a Webflow page, paste the application embed with a
     new slug, then add an entry here. Nothing else needs to change.
     ====================================================================== */
  var ROLES = {
    "video-editor": { label: "Video Editor", sjt: null },
    "social-media-manager": { label: "Social Media Manager", sjt: null }
  };

  /* ======================================================================
     SITUATIONAL ASSESSMENT for video-editor. Twenty scenarios.
     To reword, add or remove a scenario, edit THIS array only. The markup,
     validation, review screen and saved draft all derive from it. If the
     count changes, update COLUMNS and HEADERS in apps-script-doPost.gs so
     the sheet stays aligned.
     ====================================================================== */
  var SJT = [
    { q: "You just submitted a final video edit to your manager, but within 30 minutes you notice you exported the wrong audio mix (for example, an unmastered or muted track) instead of the approved one. There is still time to fix it before the client sees it.",
      o: ["Wait until your manager reviews the video. If they ask about it, you will admit it then and fix it.",
          "Message your manager immediately, explain exactly what happened, and send the corrected export before the deadline.",
          "Quietly re-render and swap in the corrected file without telling anyone, so nobody finds out about the mistake."] },
    { q: "You have posted a rough cut of a promotional video to a shared drive for your team to review. You know the edit takes an unconventional approach (for example, unusual pacing or transitions). Two colleagues, X and Y, have very different feedback styles: X is blunt and often harsh, Y is overly polite and rarely critical.",
      o: ["Ask Y for feedback first. If Y’s comments seem too mild, you will ask X in person later.",
          "Ask both X and Y for detailed feedback and explicitly ask them to be brutally honest. Value X’s directness even if it is uncomfortable.",
          "Rely on informal reactions, like emoji replies in Slack. If no one says anything bad, you assume the edit is fine."] },
    { q: "You discover a critical export issue (for example, audio sync drift or the wrong codec) an hour before a major video is scheduled to go live. Fixing it properly takes about two hours. Your marketing lead just told you the video must go live in 30 minutes, no exceptions.",
      o: ["Let the video go live on schedule, then plan to quietly re-upload a fixed version later.",
          "Explain candidly: “If we publish now without fixing this, viewers will notice the sync issue and it could hurt our brand. Can we get 30 more minutes, or publish a placeholder instead?”",
          "Apply a quick patch that hides the issue just enough to pass a quick check, planning to fix the real problem later."] },
    { q: "During an edit review, the senior editor insists on a particular transition style you believe will hurt viewer engagement. They are an authority figure, and the rest of the team stays silent.",
      o: ["Keep your objections to yourself, cut it their way, and hope the metrics speak for themselves later.",
          "Calmly say: “I see where you are coming from, but here is data showing a different transition keeps click-through higher. Can we test both?”",
          "Say in front of the team: “I think you are wrong, that transition is terrible and will ruin the whole piece.”"] },
    { q: "You have been working on your own side project (for example, a personal short film or demo reel) for three weeks. Now your project manager needs your full attention this weekend to help finish a rush set of client video deliverables.",
      o: ["Pause your side project for two days, then go back to it once the weekend work is done.",
          "Tell your manager: “I can help Saturday morning, but I need Sunday for my own project, so I will not be fully available both days.”",
          "Keep working on your own project all weekend and assume someone else can cover the client deliverables."] },
    { q: "You are a video editor asked to deliver a fully animated motion graphics intro, something you have never built before. The client’s budget is tight, but they expect a polished result in two weeks.",
      o: ["Build a simpler version using stock templates and basic transitions, deliver what you can, and hope the client is satisfied.",
          "Accept the work, sketch out a quick plan for learning basic motion graphics tools, and set up weekly check-ins to show progress.",
          "Politely decline: “I am more of a straight-cut editor, you would be better off hiring a dedicated motion designer.”"] },
    { q: "Your team delivered a batch of client video ads. A teammate exported the final files, and a wrong aspect ratio caused several ads to be rejected by the ad platform after delivery. You had reviewed several other files in the same batch, but not that one.",
      o: ["Explain: “It was their file and their mistake. I checked several others but missed that one.” Emphasise that it was not your file.",
          "Tell management: “I missed this in my review pass, so I take responsibility for not catching it, even though it was not the file I exported.”",
          "Imply you were not really involved with that file and let the blame land entirely on your teammate."] },
    { q: "Your marketing lead sends you a brief: “Edit a video that captures our core value of integrity.” No examples or further guidance are given.",
      o: ["Make your best guess (for example, a slow, serious tone with handshake b-roll), submit it on deadline, and adjust based on feedback.",
          "Reply: “Could you share an example you like, or tell me which part of integrity matters most: honesty, reliability, something else?”",
          "Default to generic stock footage of handshakes and skylines, without checking your interpretation first."] },
    { q: "You overhear a client privately telling a coworker that they are unhappy with a teammate’s latest video edits. The teammate has no idea the client feels this way. Speaking up means risking the trust of a conversation you were not really part of.",
      o: ["Keep it to yourself, assuming the teammate will hear it eventually, directly from the client.",
          "Find a way to let your teammate know: “I heard some concerns about the edits, wanted you to know so we can address it before it becomes a bigger issue.”",
          "Mention it to other teammates, but not the person it concerns, hoping someone else handles it."] },
    { q: "You have been working 10 to 12 hour days for the past two weeks because of overlapping deadlines: a major video campaign and a large batch of social media cutdowns.",
      o: ["Keep pushing through, and plan to take a full weekend off next month instead of slowing down now.",
          "Talk to your manager: “I need to hand off part of one project or shift a deadline, otherwise my output and quality will suffer.”",
          "Quietly let your work quality slip, hoping no one notices, rather than asking for help."] },
    { q: "It is 2 AM, and a teammate (say, a graphic designer or copywriter) is struggling to finish an urgent deck for an investor pitch happening in the morning. It is not really your job, and you are off the clock.",
      o: ["Send them a quick template or resource, but let them know you cannot stay up to do the hands-on work.",
          "Join in to help finish the work, even though it is after hours and not technically your task.",
          "Stay off duty, send a message wishing them luck, and trust them to figure it out."] },
    { q: "A junior editor presents a rough cut with several issues: mismatched audio levels, jump cuts and off-brand graphics. You know they are sensitive to criticism.",
      o: ["Send a group email: “The cut has a few errors, see my annotated notes. Please review before it goes out.”",
          "In a one-to-one, say: “I appreciate the effort. Here are a few specific things to fix so it matches our standards.”",
          "Fix it yourself overnight and send it to your manager without telling the junior editor."] },
    { q: "Your video team has been working on a custom branded short film for three weeks. Suddenly, a major client needs an urgent set of campaign videos turned around in five days, and your lead says it is all hands on deck.",
      o: ["Finish one more day on the original project, then switch over to the campaign work.",
          "Refocus right away, pause the short film work, join the campaign effort, and document where you left off so it is easy to resume.",
          "Push back: “The short film is halfway done, delaying it will push our other deadline. Can the campaign wait a day?”"] },
    { q: "You are a video editor collaborating with a scriptwriter on a promotional reel. The writer insists on a dark, serious tone, but you believe a light, upbeat style will resonate more with the target audience.",
      o: ["Keep your objections to yourself, cut the writer’s version, finish the video, and hope the metrics speak for themselves later.",
          "Calmly say: “I see where you are coming from, but here is data showing an upbeat style keeps click-through higher. Can we test both?”",
          "Publicly call out the writer: “I think you are wrong, that tone is terrible and will ruin the whole piece.”"] },
    { q: "You promised your manager you would cut a client’s video file sizes by 30% this sprint to speed up load times for web playback. You have made several optimisations but are not fully sure you have hit the target.",
      o: ["Estimate based on the changes you made: “I think we are close to 30%, but I do not have the exact number yet.”",
          "Run a before-and-after test, document the exact percentage improvement, and share a short report with the results.",
          "Wait until your manager notices the faster load times and let them ask if you hit the goal."] },
    { q: "It is launch day for a major brand video campaign streaming live across social platforms. Right after launch, you notice a visible error, such as a missing caption or the wrong audio track, on the live stream, and the CEO is referencing the campaign in a live interview.",
      o: ["Send urgent messages to several people at once across Slack, email and phone without a clear plan, causing confusion.",
          "Stay calm and message your team: “We have an issue on the live stream, let us pause it or swap to the corrected version.”",
          "Step away to collect your thoughts and hope someone else catches and fixes it."] },
    { q: "You told a client you would deliver the final cut by Friday. On Wednesday, you realise your project file is corrupted, and rebuilding the edit properly will take all of Thursday. A smaller, rough cut would only take a couple of hours.",
      o: ["Finish the rough cut Friday as promised, then quietly rebuild the rest over the weekend, hoping the client does not notice the difference.",
          "Email the client right away: “I have hit a file issue that delays the final cut until Monday. I can send a rough cut Friday in the meantime.”",
          "Work all weekend to rebuild everything and deliver the final cut Sunday night without mentioning the issue."] },
    { q: "A recurring issue keeps coming up where exported videos lose sync or quality when handed off to a client’s platform, despite several quick fixes. The team keeps re-exporting the same files every few weeks.",
      o: ["Keep reapplying the same quick fix each time it comes up, just to make the immediate complaints stop.",
          "Investigate the export and delivery pipeline, find the actual cause (for example, a frame-rate or codec mismatch), and fix it at the source.",
          "Blame whoever signed off on the files last, on the grounds that they should have caught it before sending it out."] },
    { q: "You are producing a video for a client’s product launch. You have two options: a fully custom animated sequence, which is creative but time-consuming, or a proven motion template, which is faster and tested but less novel.",
      o: ["Start the custom animation right away, confident that its originality will impress the client.",
          "Choose the template, deliver a fast and reliable result, then plan a custom version in a later phase once there is more time or budget.",
          "Create a half-template, half-custom hybrid, which risks looking inconsistent."] },
    { q: "A new editor has joined and is struggling to get up to speed on your team’s project file conventions, brand guidelines and editing software setup. They have asked for help once, but you notice they still hesitate to reach out and are making avoidable mistakes.",
      o: ["Send them a link to the team’s onboarding documents and brand guidelines, then tell them you are around if they need more help.",
          "Schedule a one-to-one to walk them through your file conventions and brand guidelines, and check in again a few days later.",
          "Wait until they come to you again, since you do not want to overwhelm them with too much hand-holding."] }
  ];

  ROLES["video-editor"].sjt = SJT;

  var ROLE = ROLES[ROLE_SLUG] || null;
  var QUESTIONS = ROLE && ROLE.sjt ? ROLE.sjt : [];

  var LETTERS = ["a", "b", "c"];
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- build the assessment ---------- */
  (function renderSJT() {
    var host = $("[data-axa-sjt]");
    if (!host || !QUESTIONS.length) return;
    var html = "";
    QUESTIONS.forEach(function (item, i) {
      var n = i + 1, name = "sjt_" + n, errId = "e-" + name;
      var pad = (n < 10 ? "0" : "") + n;
      html += '<div class="axa-q" data-label="Scenario ' + n + '" data-sjt="' + n + '">' +
        '<fieldset aria-describedby="' + errId + '">' +
        '<legend><span class="axa-qn">' + pad + " of " + SJT.length + '</span>' +
        '<span class="axa-qt">' + esc(item.q) + "</span></legend>" +
        '<div class="axa-radios">';
      item.o.forEach(function (opt, j) {
        html += '<label class="axa-radio"><input type="radio" name="' + name + '" value="' + LETTERS[j] +
          '" required><span class="axa-mark"></span><span>' + esc(opt) + "</span></label>";
      });
      html += '</div><p class="axa-err" id="' + errId + '" role="alert"></p></fieldset></div>';
    });
    host.innerHTML = html;
  })();

  /* ======================================================================
     MOTION
     ====================================================================== */

  /* split a heading into masked words or characters, preserving <br> */
  function split(el, mode) {
    if (!el || el.dataset.split) return;
    var out = "";
    Array.prototype.forEach.call(el.childNodes, function (node) {
      if (node.nodeName === "BR") { out += "<br>"; return; }
      var text = (node.textContent || "").replace(/\s+/g, " ");
      text.split(" ").forEach(function (word) {
        if (!word) return;
        if (mode === "char") {
          out += '<span class="axa-mask">' +
            word.split("").map(function (c) { return '<span class="axa-char">' + esc(c) + "</span>"; }).join("") +
            "</span> ";
        } else {
          out += '<span class="axa-mask"><span class="axa-word">' + esc(word) + "</span></span> ";
        }
      });
    });
    el.innerHTML = out.trim();
    el.dataset.split = mode || "word";
  }
  function pieces(el) { return el.querySelectorAll(".axa-char, .axa-word"); }
  function reveal(el, opts) {
    if (!MOTION || !el) return null;
    opts = opts || {};
    return gsap.fromTo(pieces(el),
      { yPercent: 110, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: opts.duration || .95, ease: "power3.out",
        stagger: opts.stagger || (el.dataset.split === "char" ? .028 : .07), delay: opts.delay || 0 });
  }

  /* radiating streak burst behind the headline */
  function buildStreaks() {
    var svg = $("[data-axa-streaks]");
    if (!svg) return [];
    var cx = 600, cy = 600, out = "";
    for (var i = 0; i < 64; i++) {
      var a = (i / 64) * Math.PI * 2 + (i % 3) * 0.014;
      var r1 = 120 + ((i * 37) % 190);
      var r2 = r1 + 130 + ((i * 53) % 340);
      out += '<line x1="' + (cx + Math.cos(a) * r1).toFixed(1) + '" y1="' + (cy + Math.sin(a) * r1).toFixed(1) +
        '" x2="' + (cx + Math.cos(a) * r2).toFixed(1) + '" y2="' + (cy + Math.sin(a) * r2).toFixed(1) +
        '" opacity="' + (0.05 + (i % 7) * 0.035).toFixed(3) + '"/>';
    }
    svg.innerHTML = out;
    return [svg, svg.querySelectorAll("line")];
  }

  /* The hero is in view at load, so its scene waits for the opening sequence. */
  var gate = { ready: false, queued: null };
  function gateRun(fn) { if (gate.ready) fn(); else gate.queued = fn; }
  function openGate() { gate.ready = true; if (gate.queued) { var f = gate.queued; gate.queued = null; f(); } }

  if (MOTION) {
    var title = $("#axa-title");
    split(title, "char");

    var streak = buildStreaks();
    var kinetic = $("[data-axa-kinetic]");
    var introExtras = $$(".axa-kicker, .axa-hero-lede, .axa-hero-stack, .axa-hero-cta, .axa-role-meta, .axa-role-body", intro);
    var blockItems = $$(".axa-block-i", document);

    gsap.set(pieces(title), { yPercent: 110, opacity: 0 });
    gsap.set(introExtras, { y: 20, opacity: 0 });
    gsap.set(blockItems, { opacity: 0, z: -150, rotateX: -36, rotateY: -42 });
    gsap.set($$("[data-axa-draw]"), { scaleX: 0 });

    var openScene = function () {
      var tl = gsap.timeline();
      if (streak[1] && streak[1].length) {
        tl.fromTo(streak[0], { opacity: 0 }, { opacity: 1, duration: .4 }, 0)
          .fromTo(streak[1],
            { attr: { opacity: 0 }, scaleX: .2, scaleY: .2, transformOrigin: "600px 600px" },
            { scaleX: 1, scaleY: 1, duration: 1.9, ease: "power4.out", stagger: { each: .006, from: "random" } }, 0)
          .to(streak[0], { opacity: .55, duration: 1.4, ease: "power2.out" }, .5);
      }
      tl.add(reveal(title), .18);
      tl.to(introExtras, { y: 0, opacity: 1, duration: .85, ease: "power3.out", stagger: .09 }, "-=0.5");
      return tl;
    };

    if (ST) {
      ST.create({ trigger: intro, start: "top 82%", once: true, onEnter: function () { gateRun(openScene); } });

      if (blockItems.length) {
        ST.create({
          trigger: ".axa-blocks", start: "top 84%", once: true,
          onEnter: function () {
            gsap.to(blockItems, { opacity: 1, z: 0, rotateX: -13, rotateY: -15, duration: 1.15,
              ease: "power3.out", stagger: .13,
              /* hand the transform back to CSS so the hover state can take over */
              clearProps: "transform" });
          }
        });
        $$(".axa-block").forEach(function (el, i) {
          gsap.to(el, {
            yPercent: -2 - (i % 2) * 3.4, ease: "none",
            scrollTrigger: { trigger: ".axa-blocks", start: "top bottom", end: "bottom top", scrub: 1.2 }
          });
        });
      }

      gsap.to("[data-axa-parallax]", {
        yPercent: 28, ease: "none",
        scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: true }
      });
      if (kinetic) {
        gsap.fromTo(kinetic, { xPercent: 6 }, {
          xPercent: -46, ease: "none",
          scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1.1 }
        });
      }
      if (streak[0]) {
        gsap.to(streak[0], {
          scale: 1.35, ease: "none",
          scrollTrigger: { trigger: intro, start: "top bottom", end: "bottom top", scrub: 1.4 }
        });
      }
    } else {
      gateRun(openScene);
      gsap.to(blockItems, { opacity: 1, z: 0, rotateX: -13, rotateY: -15, duration: 1.15, stagger: .12,
        clearProps: "transform" });
      gsap.to($$("[data-axa-draw]"), { scaleX: 1, duration: 1 });
    }
  } else {
    $$("[data-axa-draw]").forEach(function (r) { r.style.transform = "scaleX(1)"; });
  }

  /* ---------- progress spine ---------- */
  function spineFraction(step) {
    var track = fillEl.parentNode, dot = nodes[step - 1] && nodes[step - 1].querySelector(".axa-dot");
    if (!dot) return 0;
    var t = track.getBoundingClientRect(), d = dot.getBoundingClientRect();
    return t.width ? Math.max(0, Math.min(1, (d.left + d.width / 2 - t.left) / t.width)) : 0;
  }
  function paintSpine(step, full) {
    var frac = full ? 1 : spineFraction(step);
    if (MOTION) gsap.to(fillEl, { scaleX: frac, duration: full ? 1.1 : .65, ease: "power3.out" });
    else fillEl.style.transform = "scaleX(" + frac + ")";
    nodes.forEach(function (n, i) {
      var s = i + 1;
      n.classList.toggle("is-done", s < step || !!full);
      n.classList.toggle("is-active", s === step && !full);
      n.disabled = s > state.maxSeen;
      n.setAttribute("aria-current", s === step ? "step" : "false");
    });
  }

  /* ---------- step machine ---------- */
  var TITLES = ["", "Personal information", "Skills and approach", "Situational assessment",
    "Portfolio", "Introduce yourself", "Review and submit"];

  function panel(n) { return $('[data-axa-step="' + n + '"]'); }

  function scrollToY(y) {
    if (window.lenis && typeof window.lenis.scrollTo === "function") {
      window.lenis.scrollTo(y, { immediate: REDUCED, duration: REDUCED ? 0 : 0.9 });
    } else {
      window.scrollTo({ top: y, behavior: REDUCED ? "auto" : "smooth" });
    }
  }

  function go(next, skipScroll) {
    if (next === state.step) return;
    var from = state.step >= 1 ? panel(state.step) : null;
    var to = panel(next);
    var dir = next > state.step ? 1 : -1;

    if (next === 6) buildReview();
    state.maxSeen = Math.max(state.maxSeen, next);

    var show = function () {
      if (from) from.hidden = true;
      if (state.step === 0) { shell.hidden = false; }
      to.hidden = false;
      paintSpine(next);
      state.step = next;
      /* Saved after the move, not before it, so the stored part is the one the
         candidate is actually looking at when they close the tab. */
      if (HAS_FORM) saveDraft();
      live.textContent = "Step " + next + " of " + TOTAL_STEPS + ": " + TITLES[next];
      if (!skipScroll) scrollToY(window.pageYOffset + shell.getBoundingClientRect().top - 48);

      if (MOTION) {
        var tl = gsap.timeline();
        tl.fromTo(to, { y: 26 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: "power3.out", clearProps: "transform,opacity" });
        var rule = $("[data-axa-draw]", to);
        if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: .85, ease: "power3.inOut" }, .1);
        var num = $(".axa-stepno-n", to);
        if (num) tl.fromTo(num, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .5, ease: "power3.out" }, 0);
      } else {
        var r = $("[data-axa-draw]", to);
        if (r) r.style.transform = "scaleX(1)";
      }

      var first = to.querySelector("input:not([type=hidden]):not([tabindex]), select, textarea, button");
      if (first && !skipScroll) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
    };

    if (MOTION && from) {
      gsap.to(from, { y: -20 * dir, opacity: 0, duration: .32, ease: "power2.in",
        onComplete: function () { gsap.set(from, { clearProps: "transform,opacity" }); show(); } });
    } else { show(); }
  }

  /* ---------- validation ---------- */
  function fieldOf(el) { return el.closest(".axa-f") || el.closest(".axa-q"); }
  function setErr(wrap, msg) {
    if (!wrap) return;
    var p = wrap.querySelector(".axa-err");
    wrap.classList.add("is-bad");
    if (p) { p.textContent = msg; p.classList.add("is-on"); }
    if (MOTION) {
      gsap.timeline()
        .to(wrap, { x: -6, duration: .06, ease: "none" })
        .to(wrap, { x: 6, duration: .06, ease: "none" })
        .to(wrap, { x: -4, duration: .06, ease: "none" })
        .to(wrap, { x: 0, duration: .09, ease: "power2.out", clearProps: "x" });
    }
  }
  function clearErr(wrap) {
    if (!wrap) return;
    wrap.classList.remove("is-bad");
    var p = wrap.querySelector(".axa-err");
    if (p) { p.textContent = ""; p.classList.remove("is-on"); }
  }

  var FOLDER = /(drive\.google\.com\/drive\/(u\/\d+\/)?folders)|(dropbox\.com\/(sh|scl\/fo)\/)|(onedrive\.live\.com\/\?id=)|(mega\.nz\/folder)|(wetransfer\.com\/downloads)/i;
  function badUrl(v) {
    if (!/^https?:\/\/\S+\.\S+/i.test(v)) return "Enter a full link beginning with https://";
    if (FOLDER.test(v)) return "This appears to be a folder link. Link to a single video instead.";
    return "";
  }

  function validate(step) {
    var p = panel(step), bad = [];
    $$(".axa-f, .axa-q", p).forEach(clearErr);
    var flag = function (wrap, msg) { if (bad.indexOf(wrap) < 0) { bad.push(wrap); setErr(wrap, msg); } };

    if (step === 4) {
      $$("[data-axa-group]", p).forEach(function (g) {
        var slots = $$(".axa-slot", g).filter(function (s) { return !s.hidden; });
        var filled = 0;
        slots.forEach(function (s) {
          var input = $("input", s), v = input.value.trim();
          if (!v) return;
          filled++;
          var m = badUrl(v);
          if (m) flag(s, m);
        });
        if (!filled) flag(slots[0], "At least one video link is required in this category.");
      });
    } else if (step === 5) {
      var v = $("#f-iv").value.trim(), a = $("#f-ia").value.trim();
      if (!v && !a) flag($("#f-ia").closest(".axa-f"), "Provide a video link or an audio link. One of the two is required.");
      [["#f-iv", v], ["#f-ia", a]].forEach(function (pair) {
        if (pair[1]) { var m = badUrl(pair[1]); if (m) flag($(pair[0]).closest(".axa-f"), m); }
      });
    } else {
      $$(".axa-checks", p).forEach(function (group) {
        var wrap = group.closest(".axa-f");
        if (!group.querySelector("input:checked")) flag(wrap, "Select at least one.");
      });
      $$("input[required], select[required], textarea[required]", p).forEach(function (el) {
        var wrap = fieldOf(el);
        if (!wrap || bad.indexOf(wrap) > -1) return;
        if (el.type === "radio") {
          if (!p.querySelector('input[name="' + el.name + '"]:checked')) flag(wrap, "Select one option.");
          return;
        }
        var val = el.value.trim();
        if (!val) { flag(wrap, "This field is required."); return; }
        if (el.tagName === "TEXTAREA") {
          var words = wordCount(val);
          if (words > WORD_LIMIT) {
            flag(wrap, "Please shorten this to " + WORD_LIMIT + " words or fewer. It currently runs to " + words + ".");
            return;
          }
        }
        if (el.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) { flag(wrap, "Enter a valid email address."); return; }
        if (el.type === "tel" && val.replace(/\D/g, "").length < 7) { flag(wrap, "Enter a valid phone number."); return; }
        if (el.type === "url") { var m = badUrl(val); if (m) flag(wrap, m); }
      });
    }

    if (bad.length) {
      live.textContent = bad.length + (bad.length === 1 ? " answer requires attention." : " answers require attention.");
      scrollToY(window.pageYOffset + bad[0].getBoundingClientRect().top - 120);
      var f = bad[0].querySelector("input:not([type=hidden]), select, textarea");
      if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} }
      return false;
    }
    return true;
  }

  /* ---------- portfolio slots ---------- */
  function refreshGroup(key) {
    var g = $('[data-axa-group="' + key + '"]');
    var slots = $$(".axa-slot", g);
    var shown = slots.filter(function (s) { return !s.hidden; }).length;
    var btn = $('[data-axa-add="' + key + '"]');
    $("[data-axa-add-count]", btn).textContent = shown + " of " + MAX_LINKS;
    btn.disabled = shown >= MAX_LINKS;
    $(".axa-add-t", btn).textContent = shown >= MAX_LINKS ? "Maximum reached" : "Add another video";
  }
  if (HAS_FORM) $$("[data-axa-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.dataset.axaAdd;
      var next = $$(".axa-slot", $('[data-axa-group="' + key + '"]')).filter(function (s) { return s.hidden; })[0];
      if (!next) return;
      next.hidden = false;
      refreshGroup(key);
      if (MOTION) gsap.fromTo(next, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: "power3.out", clearProps: "transform,opacity" });
      var input = $("input", next);
      if (input) { try { input.focus({ preventScroll: true }); } catch (e) {} }
      live.textContent = "Video field added.";
      saveDraft();
    });
  });

  /* ---------- word counters ---------- */
  var WORD_LIMIT = 100;
  function wordCount(v) {
    v = (v || "").trim();
    return v ? v.split(/\s+/).length : 0;
  }
  function refreshCount(out) {
    var el = document.getElementById(out.dataset.axaCount);
    if (!el) return 0;
    var n = wordCount(el.value);
    out.textContent = n + " of " + WORD_LIMIT + " words";
    out.classList.toggle("is-near", n > WORD_LIMIT * 0.85 && n <= WORD_LIMIT);
    out.classList.toggle("is-over", n > WORD_LIMIT);
    return n;
  }
  $$("[data-axa-count]").forEach(function (out) {
    var el = document.getElementById(out.dataset.axaCount);
    if (!el) return;
    el.addEventListener("input", function () { refreshCount(out); });
    refreshCount(out);
  });

  /* ---------- review ---------- */
  function labelFor(input) {
    var w = input.closest("label");
    if (w) { var s = w.querySelector("span:last-child"); return s ? s.textContent.trim() : w.textContent.trim(); }
    return input.value;
  }
  function readValue(wrap) {
    var boxes = wrap.querySelectorAll('input[type="checkbox"]');
    if (boxes.length) {
      return Array.prototype.filter.call(boxes, function (b) { return b.checked; })
        .map(function (b) { return b.value; }).join(", ");
    }
    var radios = wrap.querySelectorAll('input[type="radio"]');
    if (radios.length) {
      var c = wrap.querySelector('input[type="radio"]:checked');
      if (!c) return "";
      return wrap.dataset.sjt ? c.value + ")  " + labelFor(c) : labelFor(c);
    }
    var fixed = wrap.querySelector(".axa-fixedval");
    if (fixed) return fixed.textContent.trim();
    var ctl = wrap.querySelector("input, select, textarea");
    return ctl ? ctl.value.trim() : "";
  }
  function buildReview() {
    var html = "";
    for (var s = 1; s <= 5; s++) {
      var p = panel(s);
      html += '<div class="axa-rgroup"><div class="axa-rhead"><h4>' + TITLES[s] +
        '</h4><button type="button" class="axa-link" data-axa-goto-edit="' + s + '">Edit</button></div>';
      $$(".axa-f[data-label], .axa-q[data-label]", p).forEach(function (w) {
        if (w.classList.contains("axa-slot") && w.hidden) return;  // unused portfolio slots
        var v = readValue(w);
        if (!v && w.classList.contains("axa-f") && !w.querySelector("[required]")) return;  // optional and blank
        html += '<div class="axa-rrow"><div class="axa-rk">' + esc(w.dataset.label) + "</div>" +
          '<div class="axa-rv' + (v ? "" : " is-empty") + '">' + esc(v || "Not answered") + "</div></div>";
      });
      html += "</div>";
    }
    reviewEl.innerHTML = html;
  }

  /* ---------- draft persistence ---------- */
  function fieldEls() {
    return $$("input[name], select[name], textarea[name]", form).filter(function (el) {
      return el.name && el.name !== "_hp" && el.type !== "hidden";
    });
  }
  function saveDraft() {
    try {
      var d = {};
      fieldEls().forEach(function (el) {
        if (el.type === "radio") { if (el.checked) d[el.name] = el.value; }
        else if (el.type === "checkbox") {
          if (el.checked) { d[el.name] = (d[el.name] ? d[el.name] + "\u0001" : "") + el.value; }
        }
        else if (el.value) d[el.name] = el.value;
      });
      d.__step = state.step;
      d.__slots = $$(".axa-slot").filter(function (s) { return !s.hidden; }).map(function (s) { return $("input", s).name; });
      localStorage.setItem(DRAFT_KEY_BASE + "_" + ROLE_SLUG, JSON.stringify(d));
    } catch (e) {}
  }
  function readDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY_BASE + "_" + ROLE_SLUG);
      if (!raw) return null;
      var d = JSON.parse(raw);
      return Object.keys(d).filter(function (k) { return k.indexOf("__") !== 0; }).length ? d : null;
    } catch (e) { return null; }
  }
  function applyDraft(d) {
    fieldEls().forEach(function (el) {
      if (!(el.name in d)) return;
      if (el.type === "radio") { if (el.value === d[el.name]) el.checked = true; }
      else if (el.type === "checkbox") { el.checked = String(d[el.name]).split("\u0001").indexOf(el.value) > -1; }
      else el.value = d[el.name];
    });
    (d.__slots || []).forEach(function (name) {
      var input = $('[name="' + name + '"]');
      if (input) { var slot = input.closest(".axa-slot"); if (slot) slot.hidden = false; }
    });
    ["edit", "ae"].forEach(refreshGroup);
    $$("[data-axa-count]").forEach(refreshCount);
    state.maxSeen = Math.max(1, Math.min(TOTAL_STEPS, d.__step || 1));
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY_BASE + "_" + ROLE_SLUG); } catch (e) {} }

  var saveTimer;
  var onEdit = function (e) {
    var w = fieldOf(e.target); if (w) clearErr(w);
    clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 350);
  };
  if (HAS_FORM) {
    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);
  }

  /* ---------- wiring ---------- */
  /* An application page restores its own draft on load, without asking. The
     candidate is already on the page for that role, so there is nothing to
     choose between; they are simply told, and offered a way to start over. */
  var restoredStep = 1;
  if (HAS_FORM) {
    var draft = readDraft();
    if (draft) {
      applyDraft(draft);
      restoredStep = Math.max(1, Math.min(TOTAL_STEPS, draft.__step || 1));
      var bar = $("[data-axa-restored]");
      if (bar) {
        bar.hidden = false;
        live.textContent = "Your previous answers have been restored.";
      }
    }
    var restart = $("[data-axa-restart]");
    if (restart) {
      restart.addEventListener("click", function () {
        clearDraft();
        window.location.reload();
      });
    }
  }

  $$("[data-axa-next]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var s = state.step;
      if (!validate(s)) return;
      if (MOTION) gsap.fromTo(btn, { scale: 1 }, { scale: 1.035, duration: .12, yoyo: true, repeat: 1, ease: "power2.out", clearProps: "scale" });
      saveDraft();
      go(s + 1);
    });
  });
  $$("[data-axa-prev]").forEach(function (btn) {
    btn.addEventListener("click", function () { go(state.step - 1); });
  });
  nodes.forEach(function (n) {
    n.addEventListener("click", function () {
      var t = parseInt(n.dataset.axaGoto, 10);
      if (t <= state.maxSeen) go(t);
    });
  });
  if (reviewEl) reviewEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-axa-goto-edit]");
    if (b) go(parseInt(b.dataset.axaGotoEdit, 10));
  });

  /* ---------- submit ---------- */
  function collect() {
    /* Checkbox groups post the same key several times. Apps Script only reads the
       first, so repeated keys are joined into one cell before sending. */
    var bag = {}, order = [];
    new FormData(form).forEach(function (v, k) {
      v = typeof v === "string" ? v.trim() : v;
      if (!(k in bag)) { bag[k] = []; order.push(k); }
      bag[k].push(v);
    });
    var params = new URLSearchParams();
    order.forEach(function (k) { params.set(k, bag[k].join(", ")); });
    if (ROLE) { params.set("position", ROLE.label); params.set("role_slug", ROLE_SLUG); }
    params.set("meta_submitted_at", new Date().toISOString());
    params.set("meta_user_agent", navigator.userAgent || "");
    try { params.set("meta_timezone", Intl.DateTimeFormat().resolvedOptions().timeZone || ""); } catch (e) {}
    return params;
  }

  function post(params) {
    /* urlencoded body with no custom headers is a simple CORS request, so there is
       no preflight and the Apps Script JSON response is readable. Success is only
       declared when that response reports ok:true, so a failed write cannot be
       mistaken for a successful one. */
    return fetch(GOOGLE_SHEETS_ENDPOINT, { method: "POST", body: params })
      .then(function (res) { return res.text(); })
      .then(function (txt) {
        var data;
        try { data = JSON.parse(txt); } catch (e) { throw new Error("unreadable response"); }
        if (!data || data.ok !== true || !data.id) throw new Error(data && data.error ? data.error : "rejected by server");
        return data;
      });
  }

  function fail(msg) {
    state.sending = false;
    submitBtn.disabled = false;
    submitLabel.textContent = "Submit application";
    submitErr.textContent = msg;
    submitErr.classList.add("is-on");
    live.textContent = msg;
  }

  function succeed(id) {
    clearDraft();
    $("[data-axa-refid]").textContent = id;
    live.textContent = "Application submitted. Your reference number is " + id + ".";
    paintSpine(TOTAL_STEPS, true);

    var show = function () {
      shell.hidden = true;
      $$(".axa-step").forEach(function (s) { s.hidden = true; });
      /* On an application page the role header is part of the form, not of the
         confirmation. Once the application is in, the page is the thank you. */
      if (PAGE === "apply" && intro) intro.hidden = true;
      done.hidden = false;
      var h = $("[data-axa-reveal-done]");
      if (MOTION) {
        split(h, "char");
        gsap.set(pieces(h), { yPercent: 110, opacity: 0 });
        var tl = gsap.timeline();
        tl.fromTo("[data-axa-bloom]", { scale: .2, opacity: 0 },
          { scale: 1, opacity: 1, duration: 1.5, ease: "power3.out" }, 0)
          .to("[data-axa-bloom]", { opacity: .35, duration: 1.2, ease: "power2.out" }, 1.1)
          .fromTo($(".axa-done .axa-kicker"), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: "power3.out" }, .15)
          .add(reveal(h), .3)
          .fromTo($$(".axa-done-ref, .axa-done .axa-rule, .axa-done .axa-meta"), { y: 16, opacity: 0 },
            { y: 0, opacity: 1, duration: .8, ease: "power3.out", stagger: .09 }, "-=0.35");
      }
      scrollToY(window.pageYOffset + done.getBoundingClientRect().top - 80);
    };
    if (MOTION) gsap.delayedCall(1.15, show); else show();
  }

  if (HAS_FORM) form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.sending) return;
    if ($("#axa-hp").value) return;

    for (var s = 1; s <= 5; s++) {
      if (!validate(s)) { go(s); return; }
    }
    if (GOOGLE_SHEETS_ENDPOINT.indexOf("REPLACE") === 0) {
      fail("This form is not connected yet. Set GOOGLE_SHEETS_ENDPOINT in aurix-apply.js.");
      return;
    }

    state.sending = true;
    submitBtn.disabled = true;
    submitLabel.textContent = "Submitting";
    submitErr.classList.remove("is-on");
    live.textContent = "Submitting your application.";

    var params = collect();
    post(params)
      .catch(function () { return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return post(params); }); })
      .then(function (data) { succeed(data.id); })
      .catch(function (err) {
        fail("Your application could not be submitted (" + (err && err.message ? err.message : "network error") +
          "). Your answers are saved in this browser. Check your connection and select Submit again. " +
          "If the problem continues, email grow@aurixlab.ca and we will take it from there.");
      });
  });


  /* ======================================================================
     PAGE CHROME. Opening sequence, navigation, section reveals, anchors.
     Everything here is decided against REDUCED before a timeline exists.
     ====================================================================== */
  var page = document.querySelector(".axa-page");
  var nav = $("[data-axa-nav]", document);

  /* ---------- opening sequence ----------
     Aurix Lab fades away, then We are hiring pushes in towards the viewer
     and the five panels lift. Runs on every load; skipped under reduced
     motion, where the overlay is removed before it is ever painted. */
  function openingSequence(onDone) {
    var pre = document.querySelector("[data-axa-pre]");
    if (!pre || !MOTION) { if (pre) pre.remove(); onDone(); return; }

    pre.hidden = false;
    if (page) page.classList.add("is-loading");
    window.scrollTo(0, 0);

    var one = pre.querySelector("[data-axa-pre-1]");
    var two = pre.querySelector("[data-axa-pre-2]");
    var panels = pre.querySelectorAll(".axa-curtain span");

    var tl = gsap.timeline({
      onComplete: function () {
        pre.remove();
        if (page) page.classList.remove("is-loading");
        onDone();
      }
    });

    tl.set(panels, { scaleY: 0, transformOrigin: "bottom center" })
      /* Aurix Lab: settles in, holds, then dissolves rather than moving */
      .fromTo(one, { opacity: 0, scale: 1.06, filter: "blur(9px)" },
        { opacity: 1, scale: 1, filter: "blur(0px)", duration: 1.15, ease: "power3.out" })
      .to(one, { opacity: 0, filter: "blur(7px)", duration: .75, ease: "power2.inOut" }, "+=0.55")
      /* We are hiring: a slow push in from depth, held a beat at the end */
      .fromTo(two, { opacity: 0, scale: .62, z: -420, filter: "blur(14px)" },
        { opacity: 1, scale: 1, z: 0, filter: "blur(0px)", duration: 1.5, ease: "expo.out" }, "-=0.28")
      .to(two, { scale: 1.14, duration: 1.15, ease: "power2.in" }, "-=0.22")
      /* curtain sweeps up over the push, then lifts off the top */
      .to(panels, { scaleY: 1, duration: .46, ease: "power4.inOut", stagger: .05 }, "-=0.72")
      .set(panels, { transformOrigin: "top center" })
      .set(pre, { backgroundColor: "transparent" })
      .set([one, two], { opacity: 0 })
      .to(panels, { scaleY: 0, duration: .62, ease: "power4.inOut", stagger: .055 });
    return tl;
  }

  /* ---------- navigation ---------- */
  (function navigation() {
    if (!nav) return;
    var bar = $("[data-axa-progress] span", document);
    var links = $$(".axa-nav-links a", document);
    var lastY = window.pageYOffset, ticking = false;

    var update = function () {
      var y = window.pageYOffset;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, y / h) : 0) + ")";
      /* hide going down, show going up, always show at the top */
      if (y > 140 && y > lastY + 4) nav.classList.add("is-hidden");
      else if (y < lastY - 4 || y < 140) nav.classList.remove("is-hidden");
      lastY = y;
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();

    /* mark the section currently in view */
    if (ST) {
      links.forEach(function (a) {
        var target = document.querySelector(a.getAttribute("href"));
        if (!target) return;
        ST.create({
          trigger: target, start: "top 45%", end: "bottom 45%",
          onToggle: function (self) { a.classList.toggle("is-current", self.isActive); }
        });
      });
    }
  })();

  /* ---------- anchor links, routed through Lenis when present ---------- */
  $$("[data-axa-anchor]", document).forEach(function (a) {
    a.addEventListener("click", function (e) {
      var target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      scrollToY(window.pageYOffset + target.getBoundingClientRect().top - 72);
      try { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); } catch (err) {}
    });
  });

  /* ---------- section reveals ---------- */
  function sectionScenes() {
    if (!MOTION) {
      $$(".axa-eyebrow-l", document).forEach(function (l) { l.style.transform = "scaleX(1)"; });
      return;
    }
    var eyebrows = $$("[data-axa-eye]", document);
    var fades = $$("[data-axa-fade]", document);
    var listRows = $$("[data-axa-list] > li", document);
    var secHeads = $$('.axa-sec [data-axa-reveal], .axa-foot [data-axa-reveal], .axa-quote [data-axa-reveal]', document);

    secHeads.forEach(function (h) { split(h, h.dataset.axaReveal); gsap.set(pieces(h), { yPercent: 110, opacity: 0 }); });
    gsap.set(fades, { y: 22, opacity: 0 });
    gsap.set(listRows, { y: 26, opacity: 0 });
    eyebrows.forEach(function (e) { gsap.set($(".axa-eyebrow-l", e), { scaleX: 0 }); });

    var run = function (scope) {
      var tl = gsap.timeline();
      var eye = $("[data-axa-eye]", scope);
      if (eye) tl.to($(".axa-eyebrow-l", eye), { scaleX: 1, duration: .7, ease: "power3.inOut" }, 0);
      /* a section may hold several reveal headings, for instance a heading and a
         pull quote; each is revealed in turn rather than only the first */
      $$("[data-axa-reveal]", scope).forEach(function (h, i) {
        tl.add(reveal(h), i === 0 ? .12 : "-=0.35");
      });
      var f = $$("[data-axa-fade]", scope);
      if (f.length) tl.to(f, { y: 0, opacity: 1, duration: .8, ease: "power3.out", stagger: .09 }, "-=0.5");
      var rows = $$("[data-axa-list] > li", scope);
      if (rows.length) tl.to(rows, { y: 0, opacity: 1, duration: .75, ease: "power3.out", stagger: .08 }, "-=0.45");
    };

    $$("[data-axa-sec]", document).forEach(function (sec) {
      if (ST) ST.create({ trigger: sec, start: "top 76%", once: true, onEnter: function () { run(sec); } });
      else run(sec);
    });
  }

  /* ---------- init ---------- */
  if (HAS_FORM) {
    ["edit", "ae"].forEach(refreshGroup);
    paintSpine(1);
    /* An application page opens straight on the form, at whichever part the
       candidate last reached. */
    go(restoredStep, true);
  }
  sectionScenes();
  if (MOTION) { if (window.lenis && window.lenis.stop) window.lenis.stop(); }
  openingSequence(function () {
    if (window.lenis && window.lenis.start) window.lenis.start();
    openGate();
  });
  window.addEventListener("resize", function () { if (HAS_FORM && state.step) paintSpine(state.step); });
  window.addEventListener("beforeunload", function () { if (HAS_FORM && state.step >= 1 && !state.sending) saveDraft(); });
})();