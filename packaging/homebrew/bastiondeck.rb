class Bastiondeck < Formula
  desc "Bring private-network services to localhost through SSH bastion hosts"
  homepage "https://github.com/DimaUsenko/bastiondeck"
  url "https://github.com/DimaUsenko/bastiondeck/releases/download/v0.1.1/bastiondeck-source.tar.gz"
  sha256 "943e39ff572b76ca9b48bf62707974144abf9ff913cd089418a6fd34613d6db6"
  license "MIT"

  depends_on "node@22"

  def install
    system "npm", "ci", "--omit=dev"
    libexec.install Dir["*"]
    (bin/"bastiondeck").write_env_script libexec/"bin/bastiondeck.mjs",
      PATH: "#{Formula["node@22"].opt_bin}:$PATH"
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
