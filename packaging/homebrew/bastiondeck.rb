class Bastiondeck < Formula
  desc "Local web panel to create and monitor SSH port-forward tunnels"
  homepage "https://github.com/DimaUsenko/bastiondeck"
  url "https://github.com/DimaUsenko/bastiondeck/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "REPLACE_WITH_RELEASE_TARBALL_SHA256"
  license "MIT"

  depends_on "node@22"

  def install
    system "npm", "ci"
    system "npm", "run", "build"

    libexec.install Dir["*"]
    bin.install_symlink libexec/"bin/bastiondeck.mjs" => "bastiondeck"
  end

  def caveats
    <<~EOS
      Start BastionDeck:
        bastiondeck

      Default URL:
        http://127.0.0.1:8787

      Persistent settings live in:
        ~/.bastiondeck

      Custom bind/public address:
        bastiondeck --host 0.0.0.0 --url-host my-laptop.local
    EOS
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bastiondeck --version")
  end
end
