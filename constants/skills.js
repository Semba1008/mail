// 案件検索フォームのスキル絞り込みで使う、カテゴリごとのスキルリスト
// pages/index.js の検索フォームから参照される
export const skillCategories = [
  {
    label: "Language / Backend",
    skills: [
      "Java",
      "PHP",
      "Python",
      "Ruby",
      "Go",
      "C#",
      "C++",
      "Rust",
      "Kotlin",
      "Swift",
    ],
  },
  {
    label: "Frontend",
    skills: [
      "React",
      "Next.js",
      "Vue.js",
      "Nuxt.js",
      "TypeScript",
      "JavaScript",
    ],
  },
  {
    label: "Infra / OS / Cloud",
    skills: [
      "AWS",
      "Azure",
      "GCP",
      "Docker",
      "Kubernetes",
      "Linux",
      "Windows",
      "Terraform",
    ],
  },
  {
    label: "DB / Tool / CI/CD",
    skills: [
      "MySQL",
      "PostgreSQL",
      "Oracle",
      "Git",
      "GitHub",
      "CircleCI",
      "Jenkins",
      "Ansible",
    ],
  },
];
