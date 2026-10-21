# 发布到 GitHub Pages

这个游戏可以作为静态网站发布到 GitHub Pages，发布后电脑和手机直接访问 HTTPS 网址即可，不需要保持开发电脑开机，也不需要手机和电脑连接同一 Wi-Fi。

项目已包含自动部署配置：每次推送到 `main`，GitHub Actions 会安装依赖、运行规则测试、构建游戏，并将 `dist/` 发布到 Pages。`vite.config.ts` 使用相对资源路径，支持仓库名称对应的子目录。

## 第一次发布

1. 登录 GitHub，新建一个 **Public（公开）** 仓库，例如 `catProtect`。创建空仓库，不勾选自动生成 README、`.gitignore` 或许可证；这些选项可能让远端先产生一个提交。
2. 在仓库的 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。如果空仓库暂未显示此选项，先完成下一步上传，再回来设置。
3. 在 PowerShell 中运行以下命令。先把远端地址里的 `你的用户名` 替换为自己的 GitHub 用户名；仓库名不同也要一并替换。

```powershell
cd D:\code\redbook\catProtect
git init -b main
git add .
git commit -m "Add cat defense game and GitHub Pages deployment"
git remote add origin https://github.com/你的用户名/catProtect.git
git push -u origin main
```

本工作目录在配置部署时尚未初始化 Git。如果你已在此目录完成上述 Git 初始化，后续直接按下面的更新流程操作即可。

第一次使用 Git 提交时，如果提示身份未设置，在本项目中配置姓名和提交邮箱，再重新执行 `git commit`：

```powershell
git config user.name "你的名字"
git config user.email "你的 GitHub 提交邮箱"
```

推送时按照 Git 凭据管理器提示登录 GitHub。项目配置不需要填写个人访问令牌或手工添加部署密钥。

4. 打开仓库 **Actions → Deploy game to GitHub Pages** 查看执行结果。如果首次运行时还没开启 Pages，完成第 2 步后选择 **Re-run all jobs**，或者使用 **Run workflow** 手动部署 `main`。
5. 部署成功后，在 **Settings → Pages** 查看正式网址，通常为：`https://你的用户名.github.io/catProtect/`。名称为 `你的用户名.github.io` 的特殊仓库会发布在根网址。

手机浏览器打开这个网址就可以玩，也可以直接把网址分享给朋友。

## 更新游戏

修改代码后在项目目录执行：

```powershell
git add .
git commit -m "Update game"
git push
```

工作流会重新构建和发布。无需手动上传 `dist/`，也无需创建 `gh-pages` 分支。

## 文件与故障检查

- 提交源码、`public/`、`package.json`、`package-lock.json`、`vite.config.ts` 和 `.github/workflows/deploy-pages.yml` 等项目文件。
- `node_modules/`、`dist/`、测试截图和日志已由 `.gitignore` 排除。无需把它们上传到仓库。
- 这是 TypeScript / Vite 源码，不能把仓库根目录直接作为成品网站发布；Pages 的 Source 应选择 GitHub Actions。
- 出现 404：检查 Actions 是否部署成功，并使用 Pages 设置页给出的完整网址，项目仓库通常需要结尾的 `/仓库名/`。
- 白屏或资源 404：检查是否保留 `vite.config.ts` 中的 `base: './'`，然后重新构建部署。
- Pages 未启用：到 Settings → Pages 设置 GitHub Actions 后重跑工作流。
- 如果以后把发布分支改成其他名称，需要同时修改工作流中的 `branches: [main]`。

GitHub Pages 托管构建后的静态文件，当前对局仍不跨页面刷新保存。发布不会改变原有游戏规则。
