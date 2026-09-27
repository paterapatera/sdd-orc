# Slot recipes

HTML fragments for `template.html` slots. Whether to include each block: [viz-rules.md](viz-rules.md) only.

## recipe:toc

```html
<ol>
  <li><a href="#intro">{{LABEL_INTRO}}</a></li>
  <li><a href="#open">{{LABEL_OPEN}}</a></li>
  <li><a href="#scope">{{LABEL_SCOPE}}</a></li>
  <li><a href="#screens">{{LABEL_SCREENS}}</a></li>
  <li><a href="#index">{{LABEL_INDEX}}</a></li>
  <li><a href="#exceptions">{{LABEL_EXCEPTIONS}}</a></li>
  <li><a href="#req-1">1. TITLE</a></li>
  <li><a href="#coverage">{{LABEL_COVERAGE}}</a></li>
</ol>
```

## recipe:stub

```html
<div class="alert" role="alert">
  <i data-lucide="circle-alert" class="alert-icon" aria-hidden="true"></i>
  <div class="alert-content">
    <h5 class="alert-title">{{LABEL_AC}}</h5>
    <p class="alert-description">ACs are not in this document yet.</p>
  </div>
</div>
```

## recipe:open

```html
<section class="req-section" id="open">
  <h2>{{LABEL_OPEN}}</h2>
  <ul><li>QUESTION</li></ul>
</section>
```

## recipe:scope

```html
<section class="req-section" id="scope">
  <h2>{{LABEL_SCOPE}}</h2>
  <div class="req-scope-grid">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title"><i data-lucide="circle-check" aria-hidden="true"></i> {{LABEL_IN}}</h3>
      </div>
      <div class="card-content">{{SCOPE_IN_LIST}}</div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3 class="card-title"><i data-lucide="circle-x" aria-hidden="true"></i> {{LABEL_OUT}}</h3>
      </div>
      <div class="card-content">{{SCOPE_OUT_LIST}}</div>
    </div>
  </div>
</section>
```

## recipe:legend

```html
<p class="req-meta">{{LABEL_LEGEND}}</p>
<div class="req-legend" aria-label="{{LABEL_LEGEND}}">
  <span class="req-legend-item">
    <span class="badge" data-ears="when">{{LABEL_EARS_WHEN}}</span>
    <span class="req-legend-hint">{{LABEL_EARS_WHEN_HINT}}</span>
  </span>
</div>
```

## recipe:screens

```html
<section class="req-section" id="screens">
  <h2>{{LABEL_SCREENS}}</h2>
  <h3 class="req-subh">{{LABEL_TRANSITIONS}}</h3>
  <div class="req-diagram"><pre class="mermaid">flowchart TD
  A --> B
  </pre></div>
  <div class="req-screen-list">
    <div class="card" id="screen-1">
      <div class="card-header"><h3 class="card-title">SCREEN</h3></div>
      <div class="card-content">
        <dl class="req-kv">
          <dt>{{LABEL_FROM}}</dt><dd>FROM</dd>
          <dt>{{LABEL_ITEMS}}</dt>
          <dd>
            <ul class="req-items">
              <li><span class="req-item-name">FIELD</span><span class="req-item-kind">CONTROL</span></li>
            </ul>
          </dd>
        </dl>
        <h4 class="req-subh">{{LABEL_BRANCH}}</h4>
        <div class="table-container">
          <table class="table" aria-label="{{LABEL_BRANCH}}">
            <thead>
              <tr class="table-row">
                <th class="table-head" scope="col">{{LABEL_PATTERN}}</th>
                <th class="table-head" scope="col">{{LABEL_COL_COND}}</th>
                <th class="table-head" scope="col">{{LABEL_COL_DEST}}</th>
                <th class="table-head" scope="col">{{LABEL_COL_RESPONSE}}</th>
                <th class="table-head" scope="col">{{LABEL_KIND}}</th>
              </tr>
            </thead>
            <tbody>
              <tr class="table-row">
                <th class="table-cell" scope="row">1</th>
                <td class="table-cell">CONDITION</td>
                <td class="table-cell">PLACE</td>
                <td class="table-cell">RESPONSE</td>
                <td class="table-cell">遷移</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</section>
```

## recipe:coverage

```html
<section class="req-section" id="coverage">
  <h2>{{LABEL_COVERAGE}}</h2>
  <p class="req-meta">{{LABEL_COVERAGE_LEAD}}</p>
  <div class="table-container">
    <table class="table" aria-label="{{LABEL_COVERAGE}}">
      <thead>
        <tr class="table-row">
          <th class="table-head" scope="col"></th>
          <th class="table-head" scope="col">{{LABEL_COL_QUESTION}}</th>
          <th class="table-head" scope="col">{{LABEL_COL_BASIS}}</th>
        </tr>
      </thead>
      <tbody>
        <tr class="table-row">
          <th class="table-cell" scope="row">GLOSS</th>
          <td class="table-cell">QUESTION</td>
          <td class="table-cell"><a href="#req-1">1.1</a> RESPONSE</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>
```

## recipe:exceptions

```html
<section class="req-section" id="exceptions">
  <h2>{{LABEL_EXCEPTIONS}}</h2>
  <div class="table-container">
    <table class="table" aria-label="{{LABEL_EXCEPTIONS}}">
      <thead>
        <tr class="table-row">
          <th class="table-head" scope="col">{{LABEL_COL_REQ}}</th>
          <th class="table-head" scope="col">{{LABEL_COL_NUM}}</th>
          <th class="table-head" scope="col">{{LABEL_COL_COND}}</th>
          <th class="table-head" scope="col">{{LABEL_COL_RESPONSE}}</th>
        </tr>
      </thead>
      <tbody>{{EXCEPTION_ROWS}}</tbody>
    </table>
  </div>
</section>
```

## recipe:index-table

```html
<div class="table-container">
  <table class="table" aria-label="{{LABEL_INDEX}}">
    <thead>
      <tr class="table-row">
        <th class="table-head" scope="col">{{LABEL_COL_ID}}</th>
        <th class="table-head" scope="col">{{LABEL_COL_PURPOSE}}</th>
        <th class="table-head" scope="col">{{LABEL_COL_AC_COUNT}}</th>
        <th class="table-head" scope="col">{{LABEL_COL_TYPES}}</th>
      </tr>
    </thead>
    <tbody>{{INDEX_ROWS}}</tbody>
  </table>
</div>
```

## recipe:requirement

```html
<details class="req-block" id="req-N">
  <summary><span>N. TITLE</span><span class="req-meta">AC_COUNT</span></summary>
  <div class="req-block-body">
    <div class="card req-story">
      <div class="card-header"><h3 class="card-title">{{LABEL_STORY}}</h3></div>
      <div class="card-content"><p class="req-story-value">PURPOSE</p></div>
    </div>
    <div>
      <h3 class="req-subh">{{LABEL_AC}}</h3>
      <div class="table-container">
        <table class="table" aria-label="{{LABEL_AC}}">
          <thead>
            <tr class="table-row">
              <th class="table-head" scope="col">{{LABEL_COL_NUM}}</th>
              <th class="table-head" scope="col">{{LABEL_COL_SUBJECT}}</th>
              <th class="table-head" scope="col">{{LABEL_COL_COND}}</th>
              <th class="table-head" scope="col">{{LABEL_COL_TYPE}}</th>
              <th class="table-head" scope="col">{{LABEL_COL_RESPONSE}}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="table-row">
              <td class="table-cell">1</td>
              <td class="table-cell">subject</td>
              <td class="table-cell">condition</td>
              <td class="table-cell"><span class="badge" data-ears="when">{{LABEL_EARS_WHEN}}</span></td>
              <td class="table-cell">response</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</details>
```

## recipe:decision-table

```html
<div>
  <h3 class="req-subh">{{LABEL_DECISION}}</h3>
  <div class="table-container">
    <table class="table req-dt" aria-label="{{LABEL_DECISION}}">
      <thead>
        <tr class="table-row">
          <th class="table-head" scope="col"></th>
          <th class="table-head" scope="col">{{LABEL_PATTERN}}1</th>
        </tr>
      </thead>
      <tbody>
        <tr class="table-row">
          <th class="table-cell" scope="row">condition</th>
          <td class="table-cell"><span class="req-dt-y">Y</span></td>
        </tr>
        <tr class="table-row req-dt-action">
          <th class="table-cell" scope="row">response</th>
          <td class="table-cell"><span class="req-dt-mark">○</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

## recipe:mermaid-flow

```html
<div>
  <h3 class="req-subh">{{LABEL_FLOW}}</h3>
  <div class="req-diagram"><pre class="mermaid">flowchart TD
  a --> b
  </pre></div>
</div>
```

## recipe:mermaid-state

```html
<div>
  <h3 class="req-subh">{{LABEL_STATE}}</h3>
  <div class="req-diagram"><pre class="mermaid">stateDiagram-v2
  A --> B: event
  </pre></div>
</div>
```

## recipe:grill-left

```html
<section class="req-section" id="grill-left">
  <h2>{{LABEL_GRILL_LEFT}}</h2>
  <ul><li><p>QUESTION</p><p>ANSWER</p></li></ul>
</section>
```
