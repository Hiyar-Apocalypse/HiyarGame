"use client";
import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import Social from "./social";
import { ethers } from "ethers";
import { gameContractABI } from "../contracts/gameContractABI";
import { relayerService } from "../lib/web3/web3";
  

// Global değişkenler - uygulama genelinde tek bir instance olmasını sağlar
let globalApp: PIXI.Application | null = null;
let isInitialized = false;

interface PixiSpriteProps {
  isGamePage?: boolean;
  account: string | null;
  env: { [key: string]: string };
}

interface RelayerInfo {
  key: string;
  nonce: number;
  isProcessing: boolean;
}

const PixiSprite = ({ isGamePage = false, account }: PixiSpriteProps) => {
  const pixiContainer = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const spriteRef = useRef<PIXI.AnimatedSprite | null>(null);
  const jumpSpriteRef = useRef<PIXI.AnimatedSprite | null>(null);
  const fireSpriteRef = useRef<PIXI.AnimatedSprite | null>(null);
  const bossRef = useRef<PIXI.AnimatedSprite | null>(null);
  const bossAngryRef = useRef<PIXI.AnimatedSprite | null>(null);
  const bossIsAngryRef = useRef(false);
  const bossAngryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const groundRef = useRef<PIXI.TilingSprite | null>(null);
  const containerRef = useRef<PIXI.Container | null>(null);
  const bulletsRef = useRef<PIXI.Sprite[]>([]);
  const bulletTextureRef = useRef<PIXI.Texture | null>(null);
  const goldTextureRef = useRef<PIXI.Texture | null>(null);
  const coinsRef = useRef<PIXI.Sprite[]>([]);
  const bossHealthRef = useRef(1000000);
  const playerHealthRef = useRef(100);
  const healthBarRef = useRef<PIXI.Graphics | null>(null);
  const playerHealthBarRef = useRef<PIXI.Graphics | null>(null);
  const healthBarContainerRef = useRef<PIXI.Container | null>(null);
  const playerHealthBarContainerRef = useRef<PIXI.Container | null>(null);
  const mainContainerRef = useRef<PIXI.Container | null>(null);
  const isMovingLeftRef = useRef(false);
  const isMovingRightRef = useRef(false);
  const isJumpingRef = useRef(false);
  const isFiringRef = useRef(false);
  const jumpVelocityRef = useRef(0);
  const jumpCountRef = useRef(0);
  const bulletCountRef = useRef(0); // Atılan mermi sayısını takip etmek için yeni ref
  const targetBossHealthRef = useRef(1000000); // Hedef boss sağlığı için yeni ref
  const displayBossHealthRef = useRef(1000000); // Görüntülenen boss sağlığı için yeni ref
  const displayPlayerHealthRef = useRef(100); // Görüntülenen oyuncu sağlığı için yeni ref
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fireTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fireIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const damageTextsRef = useRef<PIXI.Text[]>([]);
  const ammoRef = useRef(12);
  const isReloadingRef = useRef(false);
  const ammoTextRef = useRef<PIXI.Text | null>(null);
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bossBulletsRef = useRef<PIXI.Sprite[]>([]);
  const bossFireIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const deathSpriteRef = useRef<PIXI.AnimatedSprite | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const gameOverContainerRef = useRef<PIXI.Container | null>(null);
  const [showHtmlButton, setShowHtmlButton] = useState(false);
  // Oyunun aktif olup olmadığını kontrol eden değişken
  const gameActiveRef = useRef(true);
  // Turşu platformları için referans
  const platformsRef = useRef<PIXI.Sprite[]>([]);
  const platformTextureRef = useRef<PIXI.Texture | null>(null);
  const chainTextureRef = useRef<PIXI.Texture | null>(null);
  // Karakter bir platform üzerinde mi?
  const isOnPlatformRef = useRef(false);
  // Aktif platform referansı
  const currentPlatformRef = useRef<PIXI.Sprite | null>(null);
  // Ok referansları
  const arrowsRef = useRef<PIXI.Sprite[]>([]);
  const arrowTextureRef = useRef<PIXI.Texture | null>(null);
  const arrowSpawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFireTimeRef = useRef(0);
  // Ref tanımlamaları
  const shotCountRef = useRef<number>(0);
  const shotCountTextRef = useRef<PIXI.Text | null>(null);
  const txCounterRef = useRef(0);
  const txCounterTextRef = useRef<PIXI.Text | null>(null);
  // Relayer havuzu ve işlem kuyruğu için state'ler
  const relayerPoolRef = useRef<RelayerInfo[]>([]);


  
  const txQueueRef = useRef<{
    account: string;
    timestamp: number;
  }[]>([]);

  const currentRelayerIndexRef = useRef(0);
  const isProcessingQueueRef = useRef(false);

  // Lerp fonksiyonu - iki değer arasında yumuşak geçiş sağlar
  const lerp = (start: number, end: number, t: number) => {
    return start * (1 - t) + end * t;
  };

  // Hedef pozisyonu takip etmek için referanslar
  const targetXRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);

  // Hareket animasyonu
  const animateMovement = () => {
    if (!isAnimatingRef.current || !targetXRef.current || !containerRef.current) return;

    // Mevcut pozisyondan hedef pozisyona doğru %10 oranında yaklaş
    containerRef.current.x = lerp(containerRef.current.x, targetXRef.current, 0.1);

    // Hedefe yeterince yaklaştıysak animasyonu durdur
    if (Math.abs(containerRef.current.x - targetXRef.current) < 0.5) {
      containerRef.current.x = targetXRef.current;
      isAnimatingRef.current = false;
      targetXRef.current = null;
    } else {
      // Animasyonu devam ettir
      requestAnimationFrame(animateMovement);
    }
  };

  // Karakteri belirli bir pozisyona yumuşak şekilde hareket ettir
  const moveToPosition = (targetX: number) => {
    targetXRef.current = targetX;
    isAnimatingRef.current = true;
    requestAnimationFrame(animateMovement);
  };

  // Hareket fonksiyonları
  const startMovingLeft = () => {
    if (!spriteRef.current || !gameActiveRef.current || isDead || showGameOver) return;
    isMovingLeftRef.current = true;
    spriteRef.current.scale.x = -Math.abs(spriteRef.current.scale.x);
    if (jumpSpriteRef.current) {
      jumpSpriteRef.current.scale.x = -Math.abs(jumpSpriteRef.current.scale.x);
    }
    startAnimation();
  };

  const startMovingRight = () => {
    if (!spriteRef.current || !gameActiveRef.current || isDead || showGameOver) return;
    isMovingRightRef.current = true;
    spriteRef.current.scale.x = Math.abs(spriteRef.current.scale.x);
    if (jumpSpriteRef.current) {
      jumpSpriteRef.current.scale.x = Math.abs(jumpSpriteRef.current.scale.x);
    }
    startAnimation();
  };

  const stopMovingLeft = () => {
    if (!spriteRef.current || !gameActiveRef.current || isDead || showGameOver) return;
    isMovingLeftRef.current = false;
    if (!isMovingRightRef.current) {
      stopAnimation();
    }
  };

  const stopMovingRight = () => {
    if (!spriteRef.current || !gameActiveRef.current || isDead || showGameOver) return;
    isMovingRightRef.current = false;
    if (!isMovingLeftRef.current) {
      stopAnimation();
    }
  };

  const startAnimation = () => {
    if (!spriteRef.current || spriteRef.current.playing || !gameActiveRef.current || isDead || showGameOver) return;
    spriteRef.current.play();
  };

  const stopAnimation = () => {
    if (!spriteRef.current || !gameActiveRef.current || isDead || showGameOver) return;
    
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    animationTimeoutRef.current = setTimeout(() => {
      if (spriteRef.current && !isMovingLeftRef.current && !isMovingRightRef.current) {
        spriteRef.current.stop();
        spriteRef.current.gotoAndStop(0);
      }
    }, 100);
  };

  // Zıplama fonksiyonları
  const startJump = () => {
    if (!containerRef.current || !gameActiveRef.current || isDead || showGameOver) return;
    
    // Eğer yerdeyse veya ilk zıplama yapıldıysa ve ikinci zıplama hakkı varsa
    if (!isJumpingRef.current || (isJumpingRef.current && jumpCountRef.current < 1)) {
      // Eğer ilk zıplama ise
      if (!isJumpingRef.current) {
        isJumpingRef.current = true;
        jumpCountRef.current = 0; // İlk zıplama
      } else {
        jumpCountRef.current = 1; // İkinci zıplama
      }
      
      jumpVelocityRef.current = -10; // Zıplama hızını -15'ten -10'a düşürdüm
      
      if (jumpSpriteRef.current && spriteRef.current) {
        const direction = isMovingLeftRef.current ? -1 : isMovingRightRef.current ? 1 : Math.sign(spriteRef.current.scale.x);
        spriteRef.current.visible = false;
        jumpSpriteRef.current.visible = true;
        jumpSpriteRef.current.scale.x = Math.abs(jumpSpriteRef.current.scale.x) * direction;
        jumpSpriteRef.current.play();
      }
      
      // Platform üzerinde değiliz artık
      isOnPlatformRef.current = false;
      currentPlatformRef.current = null;
    }
  };

  const updateJump = () => {
    if (!containerRef.current || !containerRef.current.position || !appRef.current || !gameActiveRef.current || isDead || showGameOver) return;

    const gravity = 0.3; // Yerçekimini 0.5'ten 0.3'e düşürdüm
    
    // Eğer bir platform üzerinde değilsek yerçekimi uygula
    if (!isOnPlatformRef.current) {
      jumpVelocityRef.current += gravity;
    }
    
    const nextY = containerRef.current.y + jumpVelocityRef.current;
    const groundY = (appRef.current.screen.height || 0) - 130;

    // Platform çarpışma kontrolü
    let platformCollision = false;
    
    // Eğer karakter aşağı doğru düşüyorsa (pozitif hız) platform kontrolü yap
    if (jumpVelocityRef.current > 0) {
      for (const platform of platformsRef.current) {
        // Platformun üst kısmı ile çarpışma kontrolü - çarpışma alanını genişlettim
        if (nextY >= platform.y - 40 && 
            containerRef.current.y < platform.y - 20 && 
            Math.abs(containerRef.current.x - platform.x) < platform.width / 1.5) { // Çarpışma alanını genişlettim
          
          // Platform üzerine yerleştir
          containerRef.current.y = platform.y - 40; // Karakter pozisyonunu düzelttim
          isJumpingRef.current = false;
          jumpVelocityRef.current = 0;
          jumpCountRef.current = 0; // Zıplama sayısını sıfırla
          isOnPlatformRef.current = true;
          currentPlatformRef.current = platform;
          
          if (jumpSpriteRef.current && spriteRef.current) {
            jumpSpriteRef.current.stop();
            jumpSpriteRef.current.visible = false;
            spriteRef.current.visible = true;
            // Yere inerken son hareket yönünü koru
            const direction = isMovingLeftRef.current ? -1 : isMovingRightRef.current ? 1 : Math.sign(jumpSpriteRef.current.scale.x);
            spriteRef.current.scale.x = Math.abs(spriteRef.current.scale.x) * direction;
          }
          
          platformCollision = true;
          break;
        }
      }
    }
    
    // Eğer platform ile çarpışma yoksa normal zemin kontrolü yap
    if (!platformCollision) {
      if (nextY >= groundY) {
        containerRef.current.y = groundY;
        isJumpingRef.current = false;
        jumpVelocityRef.current = 0;
        jumpCountRef.current = 0; // Zıplama sayısını sıfırla
        isOnPlatformRef.current = false;
        currentPlatformRef.current = null;
        
        if (jumpSpriteRef.current && spriteRef.current) {
          jumpSpriteRef.current.stop();
          jumpSpriteRef.current.visible = false;
          spriteRef.current.visible = true;
          // Yere inerken son hareket yönünü koru
          const direction = isMovingLeftRef.current ? -1 : isMovingRightRef.current ? 1 : Math.sign(jumpSpriteRef.current.scale.x);
          spriteRef.current.scale.x = Math.abs(spriteRef.current.scale.x) * direction;
        }
      } else {
        containerRef.current.y = nextY;
      }
    }
    
    // Eğer platform üzerindeyken hareket ediyorsak, platformdan düşüp düşmediğimizi kontrol et
    if (isOnPlatformRef.current && currentPlatformRef.current) {
      const platform = currentPlatformRef.current;
      if (Math.abs(containerRef.current.x - platform.x) > platform.width / 1.5) { // Düşme alanını genişlettim
        isOnPlatformRef.current = false;
        currentPlatformRef.current = null;
        isJumpingRef.current = true;
        jumpVelocityRef.current = 0.1; // Hafif bir düşüş hızı başlat
      }
    }
  };

  const createBullet = () => {
    if (!containerRef.current || !bulletTextureRef.current || !mainContainerRef.current) return;
    
    // Atış sayısını artır
    shotCountRef.current++;
    if (shotCountTextRef.current) {
      shotCountTextRef.current.text = `Shots: ${shotCountRef.current}`;
    }
    
    const bullet = new PIXI.Sprite(bulletTextureRef.current);
    bullet.anchor.set(0.5); // Merkezden döndürmek için
    
    // Merminin başlangıç pozisyonu
    bullet.x = containerRef.current.x;
    bullet.y = containerRef.current.y;

    // Mermi yönü (karakterin baktığı yön)
    const direction = Math.sign(spriteRef.current?.scale.x || 1);
    bullet.scale.x = direction * 0.05; // Mermi boyutunu küçült
    bullet.scale.y = 0.05; // Mermi boyutunu küçült
    
    // Mermiyi karakterin baktığı yöne göre döndür
    if (direction > 0) { // Sağa bakarken
      bullet.rotation = Math.PI; // 180 derece döndür
    }
    
    // Mermiyi sahneye ekle
    if (!appRef.current) return;
    appRef.current.stage.addChild(bullet);
    bulletsRef.current.push(bullet);

    // Mermi hareketi
    const bulletSpeed = 15; // Mermi hızını artırdım (10'dan 15'e)
    const updateBullet = () => {
      // Mermi veya app yoksa veya mermi yok edildiyse işlemi durdur
      if (!bullet || !appRef.current || bullet.destroyed) return;

      bullet.x += bulletSpeed * direction;

      // Boss ile çarpışma kontrolü (normal veya kızgın boss)
      const normalBossVisible = bossRef.current && bossRef.current.visible;
      const angryBossVisible = bossAngryRef.current && bossAngryRef.current.visible;
      
      // Aktif olan boss'u belirle
      const activeBoss = normalBossVisible ? bossRef.current : (angryBossVisible ? bossAngryRef.current : null);
      
      if (activeBoss && 
          bullet.x > activeBoss.x - 100 && 
          bullet.x < activeBoss.x + 100 &&
          bullet.y > activeBoss.y - 150 &&
          bullet.y < activeBoss.y + 150) {
        
        // Mermi yok edilmeden önce pozisyonunu kaydet
        const bulletX = bullet.x;
        const bulletY = bullet.y;
        
        // Önce ticker'dan kaldır
        if (appRef.current?.ticker) {
          appRef.current.ticker.remove(updateBullet);
        }

        // Sonra mermiyi listeden çıkar
        bulletsRef.current = bulletsRef.current.filter(b => b !== bullet);

        // En son mermiyi temizle (eğer hala yok edilmediyse)
        if (!bullet.destroyed && appRef.current && appRef.current.stage) {
          try {
            appRef.current.stage.removeChild(bullet);
            bullet.destroy();
          } catch (error) {
            console.warn("Mermi temizlenirken hata:", error);
          }
        }
        
        // Boss'a vuruş işlemini kontrata bildir
        sendBossHit();
        
        // Merminin verdiği hasar (minimum 1 can kalacak)
        const oldHealth = bossHealthRef.current;
        
        // Atılan mermi sayısını artır
        bulletCountRef.current += 1;
        
        // Mermi sayısına göre hedef sağlığı belirle
        if (bulletCountRef.current === 30) {
          // 30 mermi atıldığında çeyreğe düşür (750000)
          targetBossHealthRef.current = 750000;
          console.log("Boss sağlığı çeyreğe düşürülüyor!");
        } else if (bulletCountRef.current === 70) {
          // 70 mermi atıldığında yarıya düşür (500000)
          targetBossHealthRef.current = 500000;
          console.log("Boss sağlığı yarıya düşürülüyor!");
        }
        
        // Yarı candan sonra daha az hasar ver
        let damage = 0;
        if (bossHealthRef.current <= 500000) {
          // Yarı candan sonra çok az hasar (0.1)
          bossHealthRef.current = Math.max(1, bossHealthRef.current - 0.1);
          damage = oldHealth - bossHealthRef.current;
        } else {
          // Normal hasar (0.5)
          bossHealthRef.current = Math.max(1, bossHealthRef.current - 0.5);
          damage = oldHealth - bossHealthRef.current;
        }
        
      
        
        // Boss'u kızgın moduna geçir
        if (!bossIsAngryRef.current && bossAngryRef.current && bossRef.current) {
          bossIsAngryRef.current = true;
          
          // Normal boss'u gizle, kızgın boss'u göster
          bossRef.current.visible = false;
          bossAngryRef.current.visible = true;
          bossAngryRef.current.play();
          
          // 3 saniye sonra normal haline dön
          if (bossAngryTimeoutRef.current) {
            clearTimeout(bossAngryTimeoutRef.current);
          }
          
          bossAngryTimeoutRef.current = setTimeout(() => {
            if (bossRef.current && bossAngryRef.current) {
              bossIsAngryRef.current = false;
              bossRef.current.visible = true;
              bossAngryRef.current.visible = false;
              bossRef.current.play();
            }
          }, 3000);
        }
        
        // Rastgele bir X konumunda altın oluştur
        if (appRef.current) {
          const randomX = Math.random() * (appRef.current.screen.width - 100) + 50;
          createFallingCoin(randomX);
        }
        
        // Hasar göstergesini oluştur (kaydedilen pozisyonu kullan)
        createDamageText(bulletX, bulletY - 20, damage);
        
        // Can barını güncelle
        if (healthBarRef.current) {
          healthBarRef.current.clear();
          const healthPercent = bossHealthRef.current / 1000000;
          const healthBarWidth = healthPercent * 200;
          
          // Gradient renk (kırmızıdan koyu kırmızıya)
          const color = Math.floor(healthPercent * 255);
          const r = Math.min(255, Math.max(180, color + 180));
          const barColor = (r << 16) | ((color * 0.2) << 8);
          
          healthBarRef.current.beginFill(barColor);
          healthBarRef.current.drawRoundedRect(0, 15, healthBarWidth, 20, 10);
          healthBarRef.current.endFill();

          // Parlama efekti
          if (healthBarWidth > 0) {
            healthBarRef.current.lineStyle(1, 0xff6666, 0.3);
            healthBarRef.current.moveTo(0, 16);
            healthBarRef.current.lineTo(healthBarWidth, 16);
          }
        }
        
        return;
      }

      // Ekran dışına çıkma kontrolü
      if (bullet.x < 0 || bullet.x > (appRef.current?.screen.width || 0)) {
        // Önce ticker'dan kaldır
        if (appRef.current?.ticker) {
          appRef.current.ticker.remove(updateBullet);
        }

        // Sonra mermiyi listeden çıkar
        bulletsRef.current = bulletsRef.current.filter(b => b !== bullet);

        // En son mermiyi temizle (eğer hala yok edilmediyse)
        if (!bullet.destroyed && appRef.current && appRef.current.stage) {
          try {
            appRef.current.stage.removeChild(bullet);
            bullet.destroy();
          } catch (error) {
            console.warn("Mermi temizlenirken hata:", error);
          }
        }
      }
    };

    if (appRef.current?.ticker) {
      appRef.current.ticker.add(updateBullet);
    }
  };

  // Ateş etme fonksiyonları
  const startFiring = () => {
    if (!containerRef.current || 
        isFiringRef.current || 
        isJumpingRef.current || 
        isMovingLeftRef.current || 
        isMovingRightRef.current ||
        isReloadingRef.current ||
        !gameActiveRef.current ||
        isDead ||
        showGameOver) return;
    
    // Mermi 0'a düştüyse otomatik reload başlat
    if (ammoRef.current <= 0) {
      startReload();
      return;
    }
    
    isFiringRef.current = true;
    
    const fire = () => {
      if (!gameActiveRef.current || isDead || showGameOver) {
        return;
      }

      // Mermi bittiyse otomatik reload başlat
      if (ammoRef.current <= 0) {
        stopFiring();
        startReload();
        return;
      }

      if (fireSpriteRef.current && spriteRef.current) {
        // Mermi sayısını azalt
        ammoRef.current--;
        updateAmmoText();

        // Mevcut yönü koru
        const direction = Math.sign(spriteRef.current.scale.x);
        spriteRef.current.visible = false;
        fireSpriteRef.current.visible = true;
        fireSpriteRef.current.scale.x = Math.abs(fireSpriteRef.current.scale.x) * direction;
        fireSpriteRef.current.gotoAndPlay(0);

        // Mermi oluştur
        createBullet();

        if (fireSpriteRef.current) {
          fireSpriteRef.current.onComplete = () => {
            if (fireSpriteRef.current) {
              fireSpriteRef.current.gotoAndStop(fireSpriteRef.current.totalFrames - 1);
            }
          };
        }
      }
    };

    // İlk atışı hemen yap
    fire();

    // Sürekli ateş etme için interval başlat - 1 saniyede bir ateş etsin
    fireIntervalRef.current = setInterval(() => {
      if (ammoRef.current > 0 && !isReloadingRef.current && gameActiveRef.current && !isDead && !showGameOver) {
        fire();
      }
    }, 1000); // 500ms'den 1000ms'ye değiştirildi (1 saniye)
    
    // 2 saniye sonra ateş etmeyi durdur
    fireTimeoutRef.current = setTimeout(() => {
      stopFiring();
    }, 2000);
  };

  const startReload = () => {
    if (isReloadingRef.current || ammoRef.current >= 12 || !gameActiveRef.current || isDead || showGameOver) return;
    
    isReloadingRef.current = true;
    stopFiring();
    
    if (ammoTextRef.current) {
      ammoTextRef.current.text = "RELOAD";
      ammoTextRef.current.style.fill = '#ff0000'; // Reload sırasında kırmızı renk
    }
    
    // 2 saniye sonra mermileri yenile
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
    }
    
    reloadTimeoutRef.current = setTimeout(() => {
      if (!gameActiveRef.current || isDead || showGameOver) return;
      
      ammoRef.current = 12;
      isReloadingRef.current = false;
      if (ammoTextRef.current) {
        ammoTextRef.current.style.fill = '#ffffff'; // Normal renk
      }
      updateAmmoText();
    }, 2000);
  };

  const updateAmmoText = () => {
   
    if (ammoTextRef.current) {
      if (!isReloadingRef.current) {
        ammoTextRef.current.text = `${ammoRef.current}/12`;
      }
    }
  };

  const stopFiring = () => {
    if (!fireSpriteRef.current || !spriteRef.current) return;
    
    // Interval'i temizle
    if (fireIntervalRef.current !== null) {
      clearInterval(fireIntervalRef.current);
      fireIntervalRef.current = null;
    }
    
    // Timeout'u temizle
    if (fireTimeoutRef.current !== null) {
      clearTimeout(fireTimeoutRef.current);
      fireTimeoutRef.current = null;
    }

    fireSpriteRef.current.stop();
    fireSpriteRef.current.visible = false;
    spriteRef.current.visible = true;
    isFiringRef.current = false;
  };

  // Hasar göstergesi oluşturma fonksiyonu
  const createDamageText = (x: number, y: number, damage: number) => {
    if (!appRef.current || !mainContainerRef.current) return;

    const damageText = new PIXI.Text(`-${damage}`, {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xff0000,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 4
    });

    damageText.x = x;
    damageText.y = y;
    mainContainerRef.current.addChild(damageText);
    damageTextsRef.current.push(damageText);

    // Hasar yazısı animasyonu
    let elapsed = 0;
    const animate = () => {
      elapsed += 0.1;
      damageText.alpha = Math.max(0, 1 - elapsed);
      damageText.y -= 1;

      if (elapsed >= 1) {
        appRef.current?.ticker.remove(animate);
        mainContainerRef.current?.removeChild(damageText);
        damageTextsRef.current = damageTextsRef.current.filter(t => t !== damageText);
        damageText.destroy();
      }
    };

    appRef.current.ticker.add(animate);
  };

  // Altın oluşturma ve düşürme fonksiyonu
  const createFallingCoin = (x: number) => {
    if (!appRef.current || !goldTextureRef.current || !mainContainerRef.current) return;

    const coin = new PIXI.Sprite(goldTextureRef.current);
    coin.anchor.set(0.5);
    coin.x = x;
    coin.y = -50; // Ekranın üstünden başla
    coin.scale.set(0.05); // Boyutu küçülttüm
    coin.zIndex = -1; // Karakterin arkasında kalacak

    // Coini ana container yerine mainContainer'a ekle (karakterin arkasında kalması için)
    mainContainerRef.current.addChildAt(coin, 1); // 1. indekse ekle (arka plan ve zemin arasına)
    coinsRef.current.push(coin);

    let velocity = { x: 0, y: 0 }; // X ve Y ekseni için hız vektörü
    const gravity = 0.5;
    const maxFallSpeed = 15;
    const rotationSpeed = 0.1;
    let isGrounded = false;
    let hasBounced = false; // Boss'a çarpıp çarpmadığını kontrol etmek için

    const updateCoin = () => {
      // Coin veya container yoksa işlemi durdur
      if (!coin || !coin.position || coin.destroyed || !mainContainerRef.current || !containerRef.current) return;
      
      // Boss ile çarpışma kontrolü
      const normalBossVisible = bossRef.current && bossRef.current.visible;
      const angryBossVisible = bossAngryRef.current && bossAngryRef.current.visible;
      const activeBoss = normalBossVisible ? bossRef.current : (angryBossVisible ? bossAngryRef.current : null);

      if (activeBoss && !hasBounced &&
          Math.abs(coin.x - activeBoss.x) < 110 && 
          Math.abs(coin.y - activeBoss.y) < 150) {
        
        // Boss'a çarptığında sola doğru fırlat
        velocity.x = -15; // Sola doğru hız
        velocity.y = -8; // Yukarı doğru hafif zıplama
        hasBounced = true; // Bir kere çarptığını işaretle
      }

      // Karakter ile çarpışma kontrolü
      const characterBounds = {
        x: containerRef.current.x,
        y: containerRef.current.y,
        width: 50,
        height: 100
      };
      
      const coinBounds = {
        x: coin.x - (coin.width * coin.scale.x) / 2,
        y: coin.y - (coin.height * coin.scale.y) / 2,
        width: coin.width * coin.scale.x,
        height: coin.height * coin.scale.y
      };
      
      if (characterBounds.x < coinBounds.x + coinBounds.width &&
          characterBounds.x + characterBounds.width > coinBounds.x &&
          characterBounds.y < coinBounds.y + coinBounds.height &&
          characterBounds.y + characterBounds.height > coinBounds.y) {
        
        console.log("Coin collected!");
        sendrewardToken();

        
        // Önce ticker'dan kaldır
        if (appRef.current?.ticker) {
          appRef.current.ticker.remove(updateCoin);
        }
        
        // Sonra coini listeden çıkar
        coinsRef.current = coinsRef.current.filter(c => c !== coin);
        
        // En son coini temizle
        if (!coin.destroyed && mainContainerRef.current) {
          try {
            mainContainerRef.current.removeChild(coin);
            coin.destroy();
          } catch (error) {
            console.warn("Altın temizlenirken hata:", error);
          }
        }
        
        return;
      }

      if (!isGrounded) {
        // X ekseni hareketi
        coin.x += velocity.x;
        // X ekseni sürtünmesi
        velocity.x *= 0.98; // Havadayken sürtünme

        // Y ekseni hareketi
        velocity.y = Math.min(velocity.y + gravity, maxFallSpeed);
        coin.y += velocity.y;
        coin.rotation += rotationSpeed;
      }

      // Yere çarptığında
      if (!isGrounded && appRef.current && coin.y > appRef.current.screen.height - 100) {
        coin.y = appRef.current.screen.height - 100;
        isGrounded = true;
        velocity.y = 0;
        velocity.x = 0; // Yere değdiğinde x ekseni hareketini durdur
      }

      // Ekran sınırları kontrolü
      if (coin.x < 0) {
        coin.x = 0;
        velocity.x = 0;
      } else if (coin.x > appRef.current!.screen.width) {
        coin.x = appRef.current!.screen.width;
        velocity.x = 0;
      }
    };

    appRef.current.ticker.add(updateCoin);
  };

  // Okların oluşturulmasını başlat
  const startArrowSpawning = () => {
    if (arrowSpawnIntervalRef.current) return;
    
    // İlk oku 15 saniye sonra oluştur
    setTimeout(() => {
      if (!gameActiveRef.current || isDead || showGameOver) return;
      createArrow(true); // Sol taraftan
      
      // Sonraki oklar için interval başlat
      arrowSpawnIntervalRef.current = setInterval(() => {
        if (!gameActiveRef.current || isDead || showGameOver) return;
        
        // Rastgele sol veya sağ taraftan ok oluştur
        const fromLeft = Math.random() > 0.5;
        createArrow(fromLeft);
      }, 15000); // 15 saniyede bir ok oluştur
    }, 15000); // İlk ok 15 saniye sonra
  };

  // Boss ateş etme fonksiyonu
  const createBossBullet = (angle: number, heightPosition: string) => {
    if (!appRef.current || !bulletTextureRef.current || !bossRef.current || !mainContainerRef.current) return;
    
    const bullet = new PIXI.Sprite(bulletTextureRef.current);
    bullet.anchor.set(0.5);
    bullet.scale.set(0.05);
    
    bullet.x = bossRef.current.x - 110;
    
    if (heightPosition === 'top') {
      bullet.y = bossRef.current.y - bossRef.current.height/2;
    } else if (heightPosition === 'bottom') {
      bullet.y = bossRef.current.y + bossRef.current.height/6;
    } else {
      bullet.y = bossRef.current.y - bossRef.current.height/6;
    }
    
    bullet.rotation = 0;
    
    mainContainerRef.current.addChild(bullet);
    bossBulletsRef.current.push(bullet);
    
    const bulletSpeed = 12;
    const updateBullet = () => {
      if (!bullet || !appRef.current || bullet.destroyed || !bullet.position || !containerRef.current || !containerRef.current.position) return;

      bullet.x -= bulletSpeed;
      
      if (Math.abs(bullet.x - containerRef.current.x) < 25 && 
          Math.abs(bullet.y - containerRef.current.y) < 50 && 
          !isDead) {
        
        if (appRef.current?.ticker) {
          appRef.current.ticker.remove(updateBullet);
        }

        bossBulletsRef.current = bossBulletsRef.current.filter(b => b !== bullet);

        if (!bullet.destroyed && mainContainerRef.current) {
          try {
            mainContainerRef.current.removeChild(bullet);
            bullet.destroy({ children: true, texture: false, baseTexture: false });
          } catch (error) {
            console.warn("Boss mermisi temizlenirken hata:", error);
          }
        }
        if (!isImmortalRef.current) {
          // Karakter öldü
          setIsDead(true);
          stopBossFiring();
       
        // Can barını anında sıfırla
        playerHealthRef.current = 0;
        displayPlayerHealthRef.current = 0;
        
        // Can barını güncelle
        if (playerHealthBarRef.current) {
          playerHealthBarRef.current.clear();
          playerHealthBarRef.current.beginFill(0xff0000);
          playerHealthBarRef.current.drawRoundedRect(0, 15, 0, 20, 10);
          playerHealthBarRef.current.endFill();
        }

        // Tüm karakter sprite'larını gizle
        if (containerRef.current) {
          if (spriteRef.current) spriteRef.current.visible = false;
          if (jumpSpriteRef.current) jumpSpriteRef.current.visible = false;
          if (fireSpriteRef.current) fireSpriteRef.current.visible = false;
          
          // Death sprite'ını yükle ve oynat
          PIXI.Assets.load('/character_death.png').then(deathTexture => {
            fetch('/character_death.json')
              .then(res => res.json())
              .then(deathAtlasData => {
                // Death frame'lerini oluştur
                const deathFrames = [];
                for (let i = 0; i <= 4; i++) {
                  const frameName = `frame_${i}`;
                  const frameData = deathAtlasData.frames[frameName];
                  if (frameData) {
                    console.log(`Loading death frame ${i}:`, frameData);
                    const texture = new PIXI.Texture(
                      deathTexture,
                      new PIXI.Rectangle(
                        frameData.frame.x,
                        frameData.frame.y,
                        frameData.frame.w,
                        frameData.frame.h
                      )
                    );
                    deathFrames.push(texture);
                  }
                }

                console.log(`Total ${deathFrames.length} death frames loaded`);

                // Death sprite'ını oluştur ve ayarla
                const deathSprite = new PIXI.AnimatedSprite(deathFrames);
                deathSprite.anchor.set(0.5);
                deathSprite.scale.set(0.5);
                deathSprite.animationSpeed = 0.1;
                deathSprite.loop = false;
                deathSpriteRef.current = deathSprite;

                // Sprite'ın yönünü ayarla
                if (spriteRef.current) {
                  deathSprite.scale.x = Math.abs(deathSprite.scale.x) * Math.sign(spriteRef.current.scale.x);
                }

                // Sprite'ı container'a eklemeden önce pozisyonunu ayarla
                deathSprite.x = 0;
                deathSprite.y = 0;
                deathSprite.visible = true; // Görünürlüğü açıkça belirt
                deathSprite.alpha = 1; // Opaklığı tam ayarla

                // Diğer sprite'ları gizle ve death sprite'ı ekle
                if (containerRef.current) {
                  if (spriteRef.current) spriteRef.current.visible = false;
                  if (jumpSpriteRef.current) jumpSpriteRef.current.visible = false;
                  if (fireSpriteRef.current) fireSpriteRef.current.visible = false;
                  
                  // Önce varsa eski death sprite'ı kaldır
                  if (deathSpriteRef.current && deathSpriteRef.current !== deathSprite) {
                    containerRef.current.removeChild(deathSpriteRef.current);
                  }
                  
                  containerRef.current.addChild(deathSprite);
                }

                console.log("Death sprite created and added");

                // Animasyonu oynat ve bitince 1. karede kal
                deathSprite.onComplete = () => {
                  if (deathSprite && !deathSprite.destroyed) {
                    console.log("Death animation completed");
                    deathSprite.gotoAndStop(1);
                    deathSprite.visible = true;
                    deathSprite.alpha = 1;
                    
                    // Container'ı güncelle
                    if (containerRef.current) {
                      containerRef.current.setChildIndex(deathSprite, containerRef.current.children.length - 1);
                    }
                  }
                };

                console.log("death çalıştı");
                deathSprite.play();
              });
          });
        }
      }
        
        return;
      }
      
      // Ekran dışına çıkma kontrolü
      if (bullet.x < 0 || bullet.x > (appRef.current?.screen.width || 0) || 
          bullet.y < 0 || bullet.y > (appRef.current?.screen.height || 0)) {
        // Önce ticker'dan kaldır
        if (appRef.current?.ticker) {
          appRef.current.ticker.remove(updateBullet);
        }

        // Sonra mermiyi listeden çıkar
        bossBulletsRef.current = bossBulletsRef.current.filter(b => b !== bullet);

        // En son mermiyi temizle (eğer hala yok edilmediyse)
        if (!bullet.destroyed && mainContainerRef.current) {
          try {
            mainContainerRef.current.removeChild(bullet);
            bullet.destroy({ children: true, texture: false, baseTexture: false });
          } catch (error) {
            console.warn("Boss mermisi temizlenirken hata:", error);
          }
        }
      }
    };
    
    appRef.current.ticker.add(updateBullet);
  };

  // Boss'un ateş etmeye başlaması
  const startBossFiring = () => {
    if (bossFireIntervalRef.current) return;
    
    // Ateş etme sırası için sayaç
    let fireCounter = 0;
    
    const fire = () => {
      // Her ateş etmede farklı bir yükseklik kullan
      const heightPositions = ['top', 'middle', 'bottom'];
      const currentPosition = heightPositions[fireCounter % 3];
      
      // Düz ateş et
      createBossBullet(0, currentPosition);
      
      // Sayacı artır
      fireCounter++;
    };
    
    // Her 2 saniyede bir ateş et (1 saniyeden 2 saniyeye çıkarıldı)
    fire();
    bossFireIntervalRef.current = setInterval(fire, 2000);
  };

  // Boss'un ateş etmeyi durdurması
  const stopBossFiring = () => {
    if (bossFireIntervalRef.current) {
      clearInterval(bossFireIntervalRef.current);
      bossFireIntervalRef.current = null;
    }
    
    // Mevcut mermileri temizle
    bossBulletsRef.current.forEach(bullet => {
      if (mainContainerRef.current) {
        mainContainerRef.current.removeChild(bullet);
        bullet.destroy();
      }
    });
    bossBulletsRef.current = [];
  };

  // Turşu platformlarını oluştur
  const createPicklePlatforms = () => {
    if (!mainContainerRef.current) return;
    
    // Ekran boyutlarını al
    const screenWidth = appRef.current?.screen.width || 800;
    const screenHeight = appRef.current?.screen.height || 600;
    
    // Platform Y pozisyonu (ekranın 2/3'ü)
    const platformY = (screenHeight / 3) * 2;
    
    // Platform pozisyonları: sol, sağ ve çapraz üst platform
    const platformPositions = [
      { x: screenWidth / 3, y: platformY },                  // Sol platform
      { x: (screenWidth / 3) * 2, y: platformY },            // Sağ platform
      { x: screenWidth / 2, y: platformY - 150 }             // Çapraz üst platform (zıplama mesafesinde)
    ];
    
    // Her platform için platform ve zincir oluştur
    platformPositions.forEach(position => {
      // Zincir görüntüsünü yükle ve ekle (sadece görsel amaçlı)
      try {
        PIXI.Assets.load('/chain.png').then(chainTexture => {
          // Zincir sprite'ı oluştur
          const chain = new PIXI.Sprite(chainTexture);
          chain.anchor.set(0.5, 1);  // Alt orta noktadan hizala (0,1 yerine 0.5,1)
          chain.x = position.x;
          chain.y = position.y + 25;  // Platformun daha altında bitir (8 piksel yerine 25 piksel)
          chain.height = position.y + 25;  // Ekranın üstünden platformun daha altına kadar
          chain.scale.set(0.25, 1);  // Genişliği biraz artır (0.2'den 0.25'e)
          
          // Zinciri ana konteynere ekle (platformların arkasında olacak)
          mainContainerRef.current?.addChild(chain);
        }).catch(error => {
          console.warn("Zincir texture'ı yüklenemedi");
        });
      } catch (error) {
        console.warn("Zincir texture'ı yüklenemedi");
      }
      
      // Platform sprite'ı oluştur
      try {
        // Platform texture'ını yüklemeyi dene
        PIXI.Assets.load('/pickel_platform.png').then(platformTexture => {
          const platform = new PIXI.Sprite(platformTexture);
          platform.anchor.set(0.5, 0.5);
          platform.x = position.x;
          platform.y = position.y;
          platform.scale.set(0.08); // Boyutu çok daha küçülttüm (0.15'ten 0.08'e)
          mainContainerRef.current?.addChild(platform);
          
          // Platformu listeye ekle
          platformsRef.current.push(platform);
        }).catch(error => {
          console.warn("Platform texture'ı yüklenemedi, yerine çizim kullanılacak");
          createFallbackPlatform(position.x, position.y);
        });
      } catch (error) {
        console.warn("Platform texture'ı yüklenemedi, yerine çizim kullanılacak");
        createFallbackPlatform(position.x, position.y);
      }
    });
  };

  // Yedek platform oluşturma fonksiyonu
  const createFallbackPlatform = (x: number, y: number) => {
    if (!mainContainerRef.current) return;
    
    // Texture yoksa yeşil bir oval çiz
    const platform = new PIXI.Graphics();
    platform.beginFill(0x33CC33);
    platform.drawEllipse(0, 0, 12, 4); // Boyutu çok daha küçülttüm (20,7'den 12,4'e)
    platform.endFill();
    
    // Kenar çizgisi ekle
    platform.lineStyle(0.5, 0x006600); // Çizgi kalınlığını da azalttım (1'den 0.5'e)
    platform.drawEllipse(0, 0, 12, 4); // Boyutu çok daha küçülttüm
    
    // Turşu deseni ekle
    platform.lineStyle(0.3, 0x006600, 0.5); // Çizgi kalınlığını da azalttım (0.5'ten 0.3'e)
    for (let i = -8; i <= 8; i += 4) { // Aralığı çok daha küçülttüm (-15,15'ten -8,8'e) ve adımı azalttım (6'dan 4'e)
      platform.moveTo(i, -3); // Y değerini çok daha küçülttüm (-5'ten -3'e)
      platform.lineTo(i + 1, 3); // Y değerini çok daha küçülttüm (5'ten 3'e) ve X ofsetini azalttım (2'den 1'e)
    }
    
    platform.x = x;
    platform.y = y;
    mainContainerRef.current?.addChild(platform);
    
    // Platformu listeye ekle
    platformsRef.current.push(platform as unknown as PIXI.Sprite);
  };

  // Oyunu yeniden başlatma fonksiyonu
  const restartGame = () => {

    
    // HTML butonunu gizle
    setShowHtmlButton(false);
    
    // TX sayacını sıfırla
    txCounterRef.current = 0;
    if (txCounterTextRef.current) {
      txCounterTextRef.current.text = '0';
    }
    
    // Sayfayı yenile
    window.location.reload();
    
    // Aşağıdaki kodlar sayfanın yenilenmesi durumunda çalışmayacak,
    // ancak yenileme işlemi başarısız olursa yedek olarak kalsın
    
    // Oyun durumunu sıfırla
    setIsDead(false);
    setShowGameOver(false);
    gameActiveRef.current = true;
    playerHealthRef.current = 100;
    bossHealthRef.current = 1000000;
    ammoRef.current = 12;
    isReloadingRef.current = false;
    isMovingLeftRef.current = false;
    isMovingRightRef.current = false;
    isJumpingRef.current = false;
    isFiringRef.current = false;
    jumpVelocityRef.current = 0;
    isOnPlatformRef.current = false;
    currentPlatformRef.current = null;
    lastFireTimeRef.current = 0; // Son ateş etme zamanını sıfırla

    // Karakteri başlangıç pozisyonuna getir
    if (containerRef.current && appRef.current) {
      containerRef.current.x = appRef.current.screen.width / 2;
      containerRef.current.y = appRef.current.screen.height - 130;
    }

    // Sprite'ları görünür yap ve sıfırla
    if (spriteRef.current) {
      spriteRef.current.visible = true;
      spriteRef.current.gotoAndStop(0);
    }
    if (jumpSpriteRef.current) {
      jumpSpriteRef.current.visible = false;
      jumpSpriteRef.current.gotoAndStop(0);
    }
    if (fireSpriteRef.current) {
      fireSpriteRef.current.visible = false;
      fireSpriteRef.current.gotoAndStop(0);
    }
    if (deathSpriteRef.current) {
      deathSpriteRef.current.visible = false;
    }

    // Boss ateşini yeniden başlat
    startBossFiring();
    
    // Okları yeniden başlat
    startArrowSpawning();

    // Game Over ekranını kaldır
    if (gameOverContainerRef.current && mainContainerRef.current) {
      mainContainerRef.current.removeChild(gameOverContainerRef.current);
      gameOverContainerRef.current = null;
    }
    
    // Mermileri temizle
    bossBulletsRef.current.forEach(bullet => {
      if (mainContainerRef.current) {
        mainContainerRef.current.removeChild(bullet);
        bullet.destroy();
      }
    });
    bossBulletsRef.current = [];
    
    bulletsRef.current.forEach(bullet => {
      if (mainContainerRef.current) {
        mainContainerRef.current.removeChild(bullet);
        bullet.destroy();
      }
    });
    bulletsRef.current = [];
    
    // Paraları temizle
    coinsRef.current.forEach(coin => {
      if (mainContainerRef.current) {
        mainContainerRef.current.removeChild(coin);
        coin.destroy();
      }
    });
    coinsRef.current = [];
    
    // Hasar metinlerini temizle
    damageTextsRef.current.forEach(text => {
      if (mainContainerRef.current) {
        mainContainerRef.current.removeChild(text);
        text.destroy();
      }
    });
    damageTextsRef.current = [];
    
    // Sağlık çubuklarını güncelle
    if (healthBarRef.current) {
      healthBarRef.current.clear();
      healthBarRef.current.beginFill(0xff3333);
      healthBarRef.current.drawRoundedRect(0, 0, 1000, 20, 10);
      healthBarRef.current.endFill();
    }
    
    if (playerHealthBarRef.current) {
      playerHealthBarRef.current.clear();
      playerHealthBarRef.current.beginFill(0x33ff33);
      playerHealthBarRef.current.drawRoundedRect(0, 15, 200, 20, 10);
      playerHealthBarRef.current.endFill();
    }
    
    // Mermi sayısını güncelle
    updateAmmoText();
  };

  // Klavye olaylarını dinleme fonksiyonları
  const handleKeyDown = (e: KeyboardEvent) => {
    // Karakter öldüyse veya ölüm ekranı gösteriliyorsa hiçbir tuş çalışmasın
    if (!gameActiveRef.current || isDead || showGameOver) return;

    if (e.key === 'a' || e.key === 'A') startMovingLeft();
    if (e.key === 'd' || e.key === 'D') startMovingRight();
    if (e.key === ' ') startJump();
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    // Karakter öldüyse veya ölüm ekranı gösteriliyorsa hiçbir tuş çalışmasın
    if (!gameActiveRef.current || isDead || showGameOver) return;

    if (e.key === 'a' || e.key === 'A') stopMovingLeft();
    if (e.key === 'd' || e.key === 'D') stopMovingRight();
  };

  // Mouse click handler'ı ekle
  const handleMouseDown = (e: MouseEvent) => {
    if (!gameActiveRef.current || isDead || showGameOver) return;
    
    // Sol tık kontrolü (button: 0 sol tık anlamına gelir)
    if (e.button === 0 && !isFiringRef.current) {
      const currentTime = Date.now();
      const lastFireTime = lastFireTimeRef.current || 0;
      
      if (currentTime - lastFireTime >= 100) {
        lastFireTimeRef.current = currentTime;
        startFiring();
      }
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!gameActiveRef.current || isDead || showGameOver) return;
    
    if (e.button === 0) {
      stopFiring();
    }
  };

  // Hareket ve animasyon fonksiyonları
  const moveSpeed = 2;
  let lastX = 0;
  
  appRef.current?.ticker.add(() => {
    // Ölüm ekranı gösteriliyorsa veya oyun aktif değilse hiçbir şey yapma
    if (!gameActiveRef.current || isDead || showGameOver) return;
    
    if (!containerRef.current || !containerRef.current.position) return;
    
    const currentX = containerRef.current.x;
    
    if (isMovingLeftRef.current && currentX > 0 + (spriteRef.current?.width || 0) / 2) {
      containerRef.current.x -= moveSpeed;
    }
    if (isMovingRightRef.current && currentX < appRef.current!.screen.width - (spriteRef.current?.width || 0) / 2) {
      containerRef.current.x += moveSpeed;
    }

    // Boss ile çarpışma kontrolü
    const normalBossVisible = bossRef.current && bossRef.current.visible;
    const angryBossVisible = bossAngryRef.current && bossAngryRef.current.visible;
    const activeBoss = normalBossVisible ? bossRef.current : (angryBossVisible ? bossAngryRef.current : null);
    
    if (activeBoss && 
        Math.abs(containerRef.current.x - activeBoss.x) < 100 && 
        Math.abs(containerRef.current.y - activeBoss.y) < 150 && 
        !isDead) {
      
      // Karakterin boss'a göre konumunu belirle
      const direction = containerRef.current.x < activeBoss.x ? -1 : 1;
      
      // Karakteri boss'tan uzağa doğru it (yumuşak geçişle)
      if (direction < 0) { // Karakter boss'un solunda
        // Hedef pozisyonu belirle ve yumuşak geçişle hareket ettir
        const targetX = activeBoss.x - 800;
        moveToPosition(targetX);
      } else { // Karakter boss'un sağında
        // Boss'un sağına geçmesini engelle
        const targetX = activeBoss.x + 100;
        moveToPosition(targetX);
      }
      
      // Ekranın ortasına doğru konumlandır (y ekseni)
      if (appRef.current) {
        const groundY = appRef.current.screen.height - 130; // Zemin seviyesi
        containerRef.current.y = groundY; // Karakteri zemin seviyesine yerleştir
      }
      
      // Zıplama durumunu sıfırla
      isJumpingRef.current = false;
      jumpVelocityRef.current = 0;
      
      // Zıplama sprite'ını gizle, normal sprite'ı göster
      if (jumpSpriteRef.current && spriteRef.current) {
        jumpSpriteRef.current.visible = false;
        spriteRef.current.visible = true;
        // Yönü boss'tan uzağa doğru ayarla
        spriteRef.current.scale.x = Math.abs(spriteRef.current.scale.x) * direction;
      }
      
      // Platform üzerinde değiliz artık
      isOnPlatformRef.current = false;
      currentPlatformRef.current = null;
    }

    // Zıplama güncelleme
    updateJump();

    // Sadece pozisyon değiştiğinde render et
    if (lastX !== currentX || isJumpingRef.current) {
      appRef.current?.renderer.render(appRef.current.stage);
      lastX = currentX;
    }
  });
  const isImmortalRef = useRef(false);
  const startImmortality = () => {
    isImmortalRef.current = true;
  
    // 30 saniye sonra ölümsüzlük durumunu kapat
    setTimeout(() => {
      isImmortalRef.current = false;
    }, 30000);
  };


  // Ölüm durumunda oyunu durdur ve Game Over ekranını göster
  useEffect(() => {

    
    startImmortality();
    if (isDead && !showGameOver && appRef.current && mainContainerRef.current) {
      console.log("Karakter öldü, tüm hareketler durduruluyor");
      
      // Oyunu devre dışı bırak
      gameActiveRef.current = false;
      
      // Tüm oyun işlevlerini durdur
      stopBossFiring();
      stopArrowSpawning();
      if (spriteRef.current) spriteRef.current.stop();
      if (jumpSpriteRef.current) jumpSpriteRef.current.stop();
      if (fireSpriteRef.current) fireSpriteRef.current.stop();
      
      // Tüm hareket durumlarını sıfırla
      isMovingLeftRef.current = false;
      isMovingRightRef.current = false;
      isJumpingRef.current = false;
      isFiringRef.current = false;
      lastFireTimeRef.current = 0; // Son ateş etme zamanını sıfırla
      
      // Tüm interval ve timeout'ları temizle
      if (fireIntervalRef.current) {
        clearInterval(fireIntervalRef.current);
        fireIntervalRef.current = null;
      }
      
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      
      if (fireTimeoutRef.current) {
        clearTimeout(fireTimeoutRef.current);
        fireTimeoutRef.current = null;
      }
      
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
      
      if (bossFireIntervalRef.current) {
        clearInterval(bossFireIntervalRef.current);
        bossFireIntervalRef.current = null;
      }
      
      // Tüm mermileri durdur
      bulletsRef.current.forEach(bullet => {
        if (bullet && !bullet.destroyed) {
          bullet.renderable = false;
        }
      });
      
      bossBulletsRef.current.forEach(bullet => {
        if (bullet && !bullet.destroyed) {
          bullet.renderable = false;
        }
      });
      
      // Ticker'ı durdur
      if (appRef.current && appRef.current.ticker) {
        // Ticker'ı durdur - bu tüm animasyonları ve hareketleri durdurur
        appRef.current.ticker.stop();
        
        // Ölüm animasyonu için yeni bir ticker oluştur
        const deathTicker = new PIXI.Ticker();
        deathTicker.start();
        
        // Ölüm animasyonu için gerekli render işlemini ekle
        deathTicker.add(() => {
          if (deathSpriteRef.current && !deathSpriteRef.current.destroyed) {
            appRef.current?.renderer.render(appRef.current.stage);
          }
        });
        
        // Death animasyonu bittikten sonra ticker'ı durdur
        setTimeout(() => {
          deathTicker.stop();
          deathTicker.destroy();
        }, 1900); // Animasyon süresinden biraz kısa tutuyoruz
      }

      // Death animasyonu bittikten sonra Game Over ekranını göster
      setTimeout(() => {
        // Eğer oyun durumu değiştiyse işlemi iptal et
        if (!isDead || showGameOver) return;
        
        // HTML ölüm ekranını göster
        setShowGameOver(true);
        
        // Klavye olaylarını devre dışı bırak
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      }, 2000); // Death animasyonunun bitmesini bekle
    }
  }, [isDead, showGameOver]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Klavye ve mouse event listener'larını ekle
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    // Cleanup fonksiyonu
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameActiveRef.current, isDead, showGameOver]); // Bağımlılıkları ekle

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pixiContainer.current) return;
    if (appRef.current) return;
    if (isInitialized && globalApp) {
      appRef.current = globalApp;
      
      if (pixiContainer.current && globalApp.view instanceof HTMLCanvasElement) {
        if (globalApp.view.parentNode) {
          globalApp.view.parentNode.removeChild(globalApp.view);
        }
        pixiContainer.current.appendChild(globalApp.view);
      }
      
      return;
    }

    console.log("Loading PixiJS...");

    import('pixi.js').then(async (PIXI) => {
      try {
        console.log("PixiJS loaded, starting application...");

        // Eğer zaten bir uygulama varsa, yenisini oluşturma
        if (isInitialized && globalApp) {
          appRef.current = globalApp;
          return;
        }

        // PixiJS uygulamasını başlat
        const app = new PIXI.Application({
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: 0x000000,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          backgroundAlpha: 1,
          clearBeforeRender: false,
        });

        // Render optimizasyonu
        app.renderer.events.autoPreventDefault = false;
        if (app.renderer.view instanceof HTMLCanvasElement) {
          app.renderer.view.style.imageRendering = 'pixelated';
          app.renderer.view.style.position = 'fixed';
          app.renderer.view.style.top = '0';
          app.renderer.view.style.left = '0';
        }
        app.stage.cullable = true;
        app.stage.eventMode = 'static';
        app.stage.interactive = true;

        appRef.current = app;
        globalApp = app; // Global değişkene ata
        isInitialized = true; // Başlatıldı olarak işaretle
        
        pixiContainer.current?.appendChild(app.view as HTMLCanvasElement);

        // Ana container oluştur
        const mainContainer = new PIXI.Container();
        app.stage.addChild(mainContainer);
        mainContainerRef.current = mainContainer;

        console.log("Loading assets...");

        try {
          // Mermi texture'ını yükle
          const bulletTexture = await PIXI.Assets.load('/bullet.png');
          bulletTextureRef.current = bulletTexture;

          // Altın texture'ını yükle
          const goldTexture = await PIXI.Assets.load('/gold.png');
          goldTextureRef.current = goldTexture;
          
          // Ok texture'ını yükle
          try {
            const arrowTexture = await PIXI.Assets.load('/ok.png');
            arrowTextureRef.current = arrowTexture;
          } catch (error) {
            console.warn("Ok texture'ı yüklenemedi:", error);
            // Yedek ok texture'ı oluştur
            const graphics = new PIXI.Graphics();
            graphics.beginFill(0xFFFFFF);
            graphics.moveTo(0, 0);
            graphics.lineTo(-15, 5);
            graphics.lineTo(-10, 0);
            graphics.lineTo(-15, -5);
            graphics.lineTo(0, 0);
            graphics.endFill();
            
            const texture = app.renderer.generateTexture(graphics);
            arrowTextureRef.current = texture;
          }

          // Boss texture ve atlas'ını yükle
          const bossTexture = await PIXI.Assets.load('/boss.png');
          const bossAtlasData = await fetch('/boss.json').then(res => res.json());

          // Arka plan resmini yükle
          const backgroundTexture = await PIXI.Assets.load('/background.png');
          const background = new PIXI.Sprite(backgroundTexture);
          
          // Floor texture'ını yükle
          const floorTexture = await PIXI.Assets.load('/floor.png');
          
          // Platform texture'ını yüklemeyi dene, hata olursa null bırak
          try {
            const platformTexture = await PIXI.Assets.load('/pickel_platform.png');
            platformTextureRef.current = platformTexture;
          } catch (error) {
            console.warn("Platform texture'ı yüklenemedi, yerine çizim kullanılacak");
            platformTextureRef.current = null;
          }
          
          // Zincir texture'ını yüklemeyi dene, hata olursa null bırak
          try {
            const chainTexture = await PIXI.Assets.load('/chain.png');
            chainTextureRef.current = chainTexture;
          } catch (error) {
            console.warn("Zincir texture'ı yüklenemedi, yerine çizim kullanılacak");
            chainTextureRef.current = null;
          }

          // Arka planı ekranı kaplayacak şekilde ayarla
          background.width = app.screen.width;
          background.height = app.screen.height;
          background.cacheAsBitmap = true; // Performans için önbellekle
          
          // Arka planı en alta ekle
          mainContainer.addChild(background);

          // Zemini oluştur
          const ground = new PIXI.TilingSprite(floorTexture, app.screen.width, 100);
          ground.y = app.screen.height - 100;
          ground.cacheAsBitmap = true;
          mainContainer.addChild(ground);
          groundRef.current = ground;

          // Kontrol talimatları
          const controlsText = new PIXI.Text('Controls:\nA - Move Left\nD - Move Right\nSPACE - Jump\nLeft Click - Fire\nSpace-Space Double Jump\nYou are immortal\n for the first 30 seconds\nBut you never know when it will end :)', {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: 0xffffff,
            stroke: 0x000000,
            strokeThickness: 4,
            lineJoin: 'round'
          });
          controlsText.x = 20;
          controlsText.y = app.screen.height - 350;
          mainContainer.addChild(controlsText);

          // Walk animasyonu için texture yükle
          const baseTexture = await PIXI.Assets.load('/character_walk.png');
          const atlasData = await fetch('/character_walk.json').then(res => res.json());

          // Jump animasyonu için texture yükle
          const jumpTexture = await PIXI.Assets.load('/character_jump.png');
          const jumpAtlasData = await fetch('/character_jump.json').then(res => res.json());

          // Fire animasyonu için texture yükle
          const fireTexture = await PIXI.Assets.load('/character_fire.png');
          const fireAtlasData = await fetch('/character_fire.json').then(res => res.json());

          console.log("Assets loaded");

          // Walk frame'lerini oluştur
          const frames = [];
          for (let i = 0; i <= 10; i++) {
            const frameName = `frame_${i}`;
            const frameData = atlasData.frames[frameName];
            if (frameData) {
              const texture = new PIXI.Texture(
                baseTexture,
                new PIXI.Rectangle(
                  frameData.frame.x,
                  frameData.frame.y,
                  frameData.frame.w,
                  frameData.frame.h
                )
              );
              frames.push(texture);
            }
          }

          // Jump frame'lerini oluştur
          const jumpFrames = [];
          for (let i = 0; i <= 10; i++) {
            const frameName = `frame_${i}`;
            const frameData = jumpAtlasData.frames[frameName];
            if (frameData) {
              const texture = new PIXI.Texture(
                jumpTexture,
                new PIXI.Rectangle(
                  frameData.frame.x,
                  frameData.frame.y,
                  frameData.frame.w,
                  frameData.frame.h
                )
              );
              jumpFrames.push(texture);
            }
          }

          // Fire frame'lerini oluştur
          const fireFrames = [];
          for (let i = 0; i <= 3; i++) {
            const frameName = `frame_${i}`;
            const frameData = fireAtlasData.frames[frameName];
            if (frameData) {
              const texture = new PIXI.Texture(
                fireTexture,
                new PIXI.Rectangle(
                  frameData.frame.x,
                  frameData.frame.y,
                  frameData.frame.w,
                  frameData.frame.h
                )
              );
              fireFrames.push(texture);
            }
          }

          // Boss frame'lerini oluştur
          const bossFrames = [];
          for (let i = 0; i <= 3; i++) {
            const frameName = `frame_${i}`;
            const frameData = bossAtlasData.frames[frameName];
            if (frameData) {
              const texture = new PIXI.Texture(
                bossTexture,
                new PIXI.Rectangle(
                  frameData.frame.x,
                  frameData.frame.y,
                  frameData.frame.w,
                  frameData.frame.h
                )
              );
              bossFrames.push(texture);
            }
          }

          if (frames.length === 0 || jumpFrames.length === 0 || fireFrames.length === 0 || bossFrames.length === 0) {
            throw new Error("Frame'ler oluşturulamadı!");
          }

          // Sprite container oluştur
          const container = new PIXI.Container();
          container.x = app.screen.width / 2;
          container.y = app.screen.height - 130;
          containerRef.current = container;

          // Boss sprite'ını oluştur
          const bossSprite = new PIXI.AnimatedSprite(bossFrames);
          bossSprite.anchor.set(0.5);
          bossSprite.x = app.screen.width - 200;
          bossSprite.y = app.screen.height - 250;
          bossSprite.scale.set(1);
          bossSprite.animationSpeed = 0.05;
          bossSprite.loop = true;
          bossSprite.play();
          mainContainer.addChild(bossSprite);
          bossRef.current = bossSprite;

          // Boss için hitbox oluştur
          const bossHitbox = new PIXI.Graphics();
          bossHitbox.beginFill(0xff0000, 0); // Tamamen şeffaf yapıldı
          bossHitbox.drawRect(-110, -150, 210, 320); // Boss sprite'ının ortasında 210x320 boyutunda bir alan (yüksekliği 20px artırıldı)
          bossHitbox.endFill();
          bossSprite.addChild(bossHitbox); // Hitbox'ı boss sprite'ına ekle

          // Boss kızgın animasyonunu yükle
          const bossAngryTexture = await PIXI.Assets.load('/Boss_angry.png');
          const bossAngryResponse = await fetch('/boss_angry.json');
          const bossAngryAtlasData = await bossAngryResponse.json();
          
          // Boss kızgın frame'lerini oluştur
          const bossAngryFrames = [];
          
          // Animasyon isimlerini al
          const angryAnimationFrames = bossAngryAtlasData.animations?.angry || [];
          
          // Her bir frame için texture oluştur
          for (const frameName of angryAnimationFrames) {
            const frameData = bossAngryAtlasData.frames[frameName];
            if (frameData) {
              const texture = new PIXI.Texture(
                bossAngryTexture,
                new PIXI.Rectangle(
                  frameData.frame.x,
                  frameData.frame.y,
                  frameData.frame.w,
                  frameData.frame.h
                )
              );
              bossAngryFrames.push(texture);
            }
          }
          
          // Kızgın boss sprite'ını oluştur
          const bossAngrySprite = new PIXI.AnimatedSprite(bossAngryFrames);
          bossAngrySprite.anchor.set(0.5);
          bossAngrySprite.x = app.screen.width - 200;
          bossAngrySprite.y = app.screen.height - 250;
          bossAngrySprite.scale.set(1);
          bossAngrySprite.animationSpeed = 0.1; // Kızgın animasyon daha hızlı
          bossAngrySprite.loop = true;
          bossAngrySprite.visible = false; // Başlangıçta gizli
          mainContainer.addChild(bossAngrySprite);
          bossAngryRef.current = bossAngrySprite;

          // Kızgın boss için hitbox oluştur
          const bossAngryHitbox = new PIXI.Graphics();
          bossAngryHitbox.beginFill(0xff0000, 0); // Tamamen şeffaf yapıldı
          bossAngryHitbox.drawRect(-110, -150, 210, 320); // Boss sprite'ının ortasında 210x320 boyutunda bir alan (yüksekliği 20px artırıldı)
          bossAngryHitbox.endFill();
          bossAngrySprite.addChild(bossAngryHitbox); // Hitbox'ı kızgın boss sprite'ına ekle

          // Boss'un ateş etmeye başlaması
          startBossFiring();
          
          // Okların oluşturulmaya başlaması
          startArrowSpawning();

          // Boss can barı container'ı
          const healthBarContainer = new PIXI.Container();
          healthBarContainer.x = app.screen.width - 320;
          healthBarContainer.y = 80;
          healthBarContainerRef.current = healthBarContainer;

          // Metalik efekt için gradient arka plan
          const bossMetallicBg = new PIXI.Graphics();
          bossMetallicBg.beginFill(0x000000, 0.6);
          bossMetallicBg.drawRoundedRect(-20, -40, 240, 100, 20);
          bossMetallicBg.endFill();
          
          // Dış parlama efekti
          const bossGlow = new PIXI.Graphics();
          bossGlow.lineStyle(3, 0xff0000, 0.3);
          bossGlow.drawRoundedRect(-23, -43, 246, 106, 22);
          bossGlow.endFill();
          
          // İç metalik kenarlık
          const bossInnerBorder = new PIXI.Graphics();
          bossInnerBorder.lineStyle(2, 0xff3333, 0.8);
          bossInnerBorder.drawRoundedRect(-20, -40, 240, 100, 20);
          bossInnerBorder.endFill();

 

          healthBarContainer.addChild(bossGlow);
          healthBarContainer.addChild(bossMetallicBg);
          healthBarContainer.addChild(bossInnerBorder);
    

          // Boss yazısı
          const bossText = new PIXI.Text('Bill Monday', {
            fontFamily: 'Verdana',
            fontSize: 28,
            fill: ['#ff4444', '#ff0000'],
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            dropShadow: true,
            dropShadowColor: '#ff0000',
            dropShadowBlur: 6,
            dropShadowDistance: 0,
            letterSpacing: 2
          });
          bossText.x = 1;
          bossText.y = -30;
          healthBarContainer.addChild(bossText);

          // Can barı dış çerçeve
          const healthBarFrame = new PIXI.Graphics();
          healthBarFrame.lineStyle(2, 0xff3333, 0.8);
          healthBarFrame.beginFill(0x000000, 0.7);
          healthBarFrame.drawRoundedRect(-5, 10, 210, 30, 15);
          healthBarFrame.endFill();
          healthBarContainer.addChild(healthBarFrame);

          // Can barı arka planı
          const healthBarBackground = new PIXI.Graphics();
          healthBarBackground.beginFill(0x330000, 0.5);
          healthBarBackground.drawRoundedRect(0, 15, 200, 20, 10);
          healthBarBackground.endFill();
          healthBarContainer.addChild(healthBarBackground);

              // Can barı
              const healthBar = new PIXI.Graphics();
              healthBar.beginFill(0xff3333);
              healthBar.drawRoundedRect(0, 15, 200, 20, 10);
              healthBar.endFill();
              healthBarRef.current = healthBar;
              healthBarContainer.addChild(healthBar);
    
              // Karakter can barı container'ı
              const playerHealthBarContainer = new PIXI.Container();
              playerHealthBarContainer.x = 90;
              playerHealthBarContainer.y = 80;
              playerHealthBarContainerRef.current = playerHealthBarContainer;
    
              // Metalik efekt için gradient arka plan
              const playerMetallicBg = new PIXI.Graphics();
              playerMetallicBg.beginFill(0x000000, 0.6);
              playerMetallicBg.drawRoundedRect(-20, -40, 240, 100, 20);
              playerMetallicBg.endFill();
              
              // Dış parlama efekti
              const playerGlow = new PIXI.Graphics();
              playerGlow.lineStyle(3, 0x00ff00, 0.3);
              playerGlow.drawRoundedRect(-23, -43, 246, 106, 22);
              playerGlow.endFill();
              
              // İç metalik kenarlık
              const playerInnerBorder = new PIXI.Graphics();
              playerInnerBorder.lineStyle(2, 0x33ff33, 0.8);
              playerInnerBorder.drawRoundedRect(-20, -40, 240, 100, 20);
              playerInnerBorder.endFill();
    
              // Sci-fi dekoratif elementler
         
  
              playerHealthBarContainer.addChild(playerGlow);
              playerHealthBarContainer.addChild(playerMetallicBg);
              playerHealthBarContainer.addChild(playerInnerBorder);
          
    
              // Little Pickle yazısı
              const playerText = new PIXI.Text('Hiyar', {
                fontFamily: 'Verdana',
                fontSize: 24,
                fill: ['#44ff44', '#00ff00'],
                fontWeight: 'bold',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center',
                dropShadow: true,
                dropShadowColor: '#00ff00',
                dropShadowBlur: 6,
                dropShadowDistance: 0,
                letterSpacing: 1
              });
              playerText.x = 60;
              playerText.y = -30;
              playerHealthBarContainer.addChild(playerText);
    
              // Karakter can barı dış çerçeve
              const playerHealthBarFrame = new PIXI.Graphics();
              playerHealthBarFrame.lineStyle(2, 0x33ff33, 0.8);
              playerHealthBarFrame.beginFill(0x000000, 0.7);
              playerHealthBarFrame.drawRoundedRect(-5, 10, 210, 30, 15);
              playerHealthBarFrame.endFill();
              playerHealthBarContainer.addChild(playerHealthBarFrame);
    
              // Karakter can barı arka planı
              const playerHealthBarBackground = new PIXI.Graphics();
              playerHealthBarBackground.beginFill(0x003300, 0.5);
              playerHealthBarBackground.drawRoundedRect(0, 15, 200, 20, 10);
              playerHealthBarBackground.endFill();
              playerHealthBarContainer.addChild(playerHealthBarBackground);
    
              // Karakter can barı
              const playerHealthBar = new PIXI.Graphics();
              playerHealthBar.beginFill(0x33ff33);
              playerHealthBar.drawRoundedRect(0, 15, 200, 20, 10);
              playerHealthBar.endFill();
              playerHealthBarRef.current = playerHealthBar;
              playerHealthBarContainer.addChild(playerHealthBar);
    
              mainContainer.addChild(healthBarContainer);
              mainContainer.addChild(playerHealthBarContainer);
          // Can barlarını güncelle
          app.ticker.add(() => {
            // Oyun aktif değilse veya karakter öldüyse güncelleme yapma
            if (!gameActiveRef.current || showGameOver) return;
            
            // Boss can barını güncelle
            if (healthBarRef.current) {
              // ... existing boss health bar code ...
            }

            // Karakter can barını güncelle
            if (playerHealthBarRef.current) {
              // Görüntülenen oyuncu sağlığını lerp ile yumuşak bir şekilde güncelle
              const lerpFactor = isDead ? 1 : 0.05;
              displayPlayerHealthRef.current = lerp(displayPlayerHealthRef.current, playerHealthRef.current, lerpFactor);
              
              // Can barını çiz
              playerHealthBarRef.current.clear();
              const healthPercent = displayPlayerHealthRef.current / 100;
              const healthBarWidth = healthPercent * 200;
              
              // Yeşilden kırmızıya renk geçişi
              const g = Math.floor(healthPercent * 255);
              const r = Math.floor((1 - healthPercent) * 255);
              const barColor = (r << 16) | (g << 8);
              
              playerHealthBarRef.current.beginFill(barColor);
              playerHealthBarRef.current.drawRoundedRect(0, 15, healthBarWidth, 20, 10);
              playerHealthBarRef.current.endFill();

              // Parlama efekti
              if (healthBarWidth > 0) {
                playerHealthBarRef.current.lineStyle(1, 0x66ff66, 0.3);
                playerHealthBarRef.current.moveTo(0, 16);
                playerHealthBarRef.current.lineTo(healthBarWidth, 16);
              }
            }
          });

          // Walk sprite'ını oluştur"
          const animatedSprite = new PIXI.AnimatedSprite(frames);
          spriteRef.current = animatedSprite;

          // Jump sprite'ını oluştur
          const jumpSprite = new PIXI.AnimatedSprite(jumpFrames);
          jumpSprite.visible = false;
          jumpSpriteRef.current = jumpSprite;

          // Fire sprite'ını oluştur
          const fireSprite = new PIXI.AnimatedSprite(fireFrames);
          fireSprite.visible = false;
          fireSprite.loop = false; // Ateş animasyonu bir kere oynatılsın
          fireSprite.animationSpeed = 0.3; // Ateş animasyonu hızı
          fireSpriteRef.current = fireSprite;

          // Sprite özelliklerini ayarla
          [animatedSprite, jumpSprite, fireSprite].forEach(sprite => {
            sprite.anchor.set(0.5);
            sprite.x = 0;
            sprite.y = 0;
            sprite.scale.set(0.5); // Boss'un yarısı kadar olacak
            if (sprite !== fireSprite) {
              sprite.animationSpeed = 0.2;
              sprite.loop = true;
            }
          });

          // Sprite'ları container'a ekle
          container.addChild(animatedSprite);
          container.addChild(jumpSprite);
          container.addChild(fireSprite);

          // Hitbox oluştur ve tüm sprite'lara ekle
          const hitbox = new PIXI.Graphics();
          hitbox.beginFill(0xff0000, 0); // Tamamen şeffaf yapıldı
          hitbox.drawRect(-25, -50, 50, 100); // Sprite'ın ortasında 50x100 boyutunda bir alan
          hitbox.endFill();
          container.addChild(hitbox);

          // Mermi sayısı text'ini oluştur
          const bulletCountText = new PIXI.Text('12/12', {
            fontFamily: 'Impact',
            fontSize: 16,
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 4,
            dropShadowDistance: 1
          });
          bulletCountText.anchor.set(0.5);
          ammoTextRef.current = bulletCountText;
          bulletCountText.x = 0;
          bulletCountText.y = -90;
          container.addChild(bulletCountText);

   

          // TX sayacı
          const txCounterText = new PIXI.Text('0', {
            fontFamily: 'Impact',
            fontSize: 20,
            fill: '#ffffff'
          });
         


          txCounterText.anchor.set(0.5);
          txCounterText.x = app.screen.width - 65;
          txCounterText.y = app.screen.height - 25;
          txCounterTextRef.current = txCounterText;
          mainContainer.addChild(txCounterText);

          // TX etiketi
          const txLabel = new PIXI.Text('TX:', {
            fontFamily: 'Impact',
            fontSize: 20,
            fill: '#ffffff'
          });
          txLabel.anchor.set(0.5);
          txLabel.x = app.screen.width - 150;
          txLabel.y = app.screen.height - 25;
          mainContainer.addChild(txLabel);

          // Container'ı ana container'a ekle
          mainContainer.addChild(container);
          setIsLoaded(true);

          // Klavye olaylarını dinle
          window.addEventListener('keydown', handleKeyDown);
          window.addEventListener('keyup', handleKeyUp);

          // Platformları oluştur
          createPicklePlatforms();

          // Oyun döngüsünde platform kontrolü ekle
          app.ticker.add(() => {
            if (!gameActiveRef.current || isDead || showGameOver) return;
            
            if (!containerRef.current || !containerRef.current.position) return;
            
            const currentX = containerRef.current.x;
            
            if (isMovingLeftRef.current && currentX > 0 + (spriteRef.current?.width || 0) / 2) {
              containerRef.current.x -= moveSpeed;
            }
            if (isMovingRightRef.current && currentX < app.screen.width - (spriteRef.current?.width || 0) / 2) {
              containerRef.current.x += moveSpeed;
            }

            // Zıplama güncelleme
            updateJump();

            // Sadece pozisyon değiştiğinde render et
            if (lastX !== currentX || isJumpingRef.current) {
              app.renderer.render(app.stage);
              lastX = currentX;
            }
          });

          console.log("Animation successfully started");

          // Event listener'ları temizle
          return () => {
   
         
            
            if (handleKeyDown && handleKeyUp) {
              window.removeEventListener('keydown', handleKeyDown);
              window.removeEventListener('keyup', handleKeyUp);
            }
            
            if (animationTimeoutRef.current) {
              clearTimeout(animationTimeoutRef.current);
            }
            
            if (fireTimeoutRef.current) {
              clearTimeout(fireTimeoutRef.current);
            }
            
            if (reloadTimeoutRef.current) {
              clearTimeout(reloadTimeoutRef.current);
            }
            
            if (appRef.current?.ticker) {
              appRef.current.ticker.destroy();
            }
            
            stopBossFiring();
            stopArrowSpawning();
          };

        } catch (error) {
          console.error("Asset processing error:", error);
          setError("Asset işlenemedi: " + (error as Error).message);
        }

      } catch (error) {
        console.error("PIXI.js initialization error:", error);
        setError("PIXI.js başlatılamadı: " + (error as Error).message);
      }
    }).catch((error) => {
      console.error("Error while loading PIXI.js:", error);
      setError("PIXI.js yüklenemedi: " + error.message);
    });

    return () => {
      if (appRef.current) {
        // Canvas'ı DOM'dan kaldır ama yok etme
        if (appRef.current.view instanceof HTMLCanvasElement && appRef.current.view.parentNode) {
          appRef.current.view.parentNode.removeChild(appRef.current.view);
        }
        
        // Interval'i temizle
        if (fireIntervalRef.current) {
          clearInterval(fireIntervalRef.current);
          fireIntervalRef.current = null;
        }
        
        if (arrowSpawnIntervalRef.current) {
          clearInterval(arrowSpawnIntervalRef.current);
          arrowSpawnIntervalRef.current = null;
        }
        
        // Son ateş etme zamanını sıfırla
        lastFireTimeRef.current = 0;
        
        // Mermileri temizle
        bulletsRef.current.forEach(bullet => {
          appRef.current?.stage.removeChild(bullet);
          bullet.destroy();
        });
        bulletsRef.current = [];
        
        // Okları temizle
        arrowsRef.current.forEach(arrow => {
          appRef.current?.stage.removeChild(arrow);
          arrow.destroy();
        });
        arrowsRef.current = [];
        
        // Referansları temizle ama uygulamayı yok etme
        appRef.current = null;
        setIsLoaded(false);

        // Coinleri temizle
        coinsRef.current.forEach(coin => {
          globalApp?.stage.removeChild(coin);
          coin.destroy();
        });
        coinsRef.current = [];
      }
    };
  }, [isGamePage]);

  // Ok oluşturma ve gönderme fonksiyonu
  const createArrow = (fromLeft: boolean) => {
    if (!appRef.current || !arrowTextureRef.current || !mainContainerRef.current || !containerRef.current) return;
    
    const arrow = new PIXI.Sprite(arrowTextureRef.current);
    arrow.anchor.set(0.5);
    arrow.scale.set(0.08); // Boyutu daha da küçülttüm (0.15'ten 0.08'e)
    
    // Okun başlangıç pozisyonu (sol veya sağ üst köşe)
    if (fromLeft) {
      arrow.x = 0;
      arrow.y = Math.random() * (appRef.current.screen.height / 3); // Üst 1/3 kısımdan rastgele
    } else {
      arrow.x = appRef.current.screen.width;
      arrow.y = Math.random() * (appRef.current.screen.height / 3); // Üst 1/3 kısımdan rastgele
    }
    
    // Oyuncuyu hedefle - ok ile oyuncu arasındaki açıyı hesapla
    const targetX = containerRef.current.x;
    const targetY = containerRef.current.y;
    const dx = targetX - arrow.x;
    const dy = targetY - arrow.y;
    const angle = Math.atan2(dy, dx);
    
    // Oku doğru açıyla döndür
    arrow.rotation = angle;
    
    mainContainerRef.current.addChild(arrow);
    arrowsRef.current.push(arrow);
    
    // Ok hızı
    const arrowSpeed = 4 + Math.random() * 2; // 4-6 arası rastgele hız
    
    const updateArrow = () => {
      if (!arrow || !appRef.current || arrow.destroyed || !arrow.position) return;
      
      arrow.x += Math.cos(angle) * arrowSpeed;
      arrow.y += Math.sin(angle) * arrowSpeed;
      
      if (containerRef.current && 
          Math.abs(arrow.x - containerRef.current.x) < 30 && 
          Math.abs(arrow.y - containerRef.current.y) < 30 && 
          !isDead) {
        
        if (appRef.current?.ticker) {
          appRef.current.ticker.remove(updateArrow);
        }
        
        arrowsRef.current = arrowsRef.current.filter(a => a !== arrow);
        
        if (!arrow.destroyed && mainContainerRef.current) {
          try {
            mainContainerRef.current.removeChild(arrow);
            arrow.destroy();
          } catch (error) {
            console.warn("Ok temizlenirken hata:", error);
          }
        }
        if (!isImmortalRef.current) {
        // Karakter öldü
        setIsDead(true);
        stopArrowSpawning();
        stopBossFiring();

        // Can barını anında sıfırla
        playerHealthRef.current = 0;
        displayPlayerHealthRef.current = 0;
        
        // Can barını güncelle
        if (playerHealthBarRef.current) {
          playerHealthBarRef.current.clear();
          playerHealthBarRef.current.beginFill(0xff0000);
          playerHealthBarRef.current.drawRoundedRect(0, 15, 0, 20, 10);
          playerHealthBarRef.current.endFill();
        }

        // Tüm karakter sprite'larını gizle
        if (containerRef.current) {
          if (spriteRef.current) spriteRef.current.visible = false;
          if (jumpSpriteRef.current) jumpSpriteRef.current.visible = false;
          if (fireSpriteRef.current) fireSpriteRef.current.visible = false;
          
          // Death sprite'ını yükle ve oynat
          PIXI.Assets.load('/character_death.png').then(deathTexture => {
            fetch('/character_death.json')
              .then(res => res.json())
              .then(deathAtlasData => {
                // Death frame'lerini oluştur
                const deathFrames = [];
                for (let i = 0; i <= 4; i++) {
                  const frameName = `frame_${i}`;
                  const frameData = deathAtlasData.frames[frameName];
                  if (frameData) {
                    console.log(`Death frame ${i} yükleniyor:`, frameData);
                    const texture = new PIXI.Texture(
                      deathTexture,
                      new PIXI.Rectangle(
                        frameData.frame.x,
                        frameData.frame.y,
                        frameData.frame.w,
                        frameData.frame.h
                      )
                    );
                    deathFrames.push(texture);
                  }
                }
                
                console.log(`Toplam ${deathFrames.length} death frame yüklendi`);
                
                // Death sprite'ını oluştur ve ayarla
                const deathSprite = new PIXI.AnimatedSprite(deathFrames);
                deathSprite.anchor.set(0.5);
                deathSprite.scale.set(0.5);
                deathSprite.animationSpeed = 0.1;
                deathSprite.loop = false;
                deathSpriteRef.current = deathSprite;
                
                // Sprite'ın yönünü ayarla
                if (spriteRef.current) {
                  deathSprite.scale.x = Math.abs(deathSprite.scale.x) * Math.sign(spriteRef.current.scale.x);
                }
                
                // Sprite'ı container'a eklemeden önce pozisyonunu ayarla
                deathSprite.x = 0;
                deathSprite.y = 0;
                deathSprite.visible = true; // Görünürlüğü açıkça belirt
                deathSprite.alpha = 1; // Opaklığı tam ayarla
                
                // Diğer sprite'ları gizle ve death sprite'ı ekle
                if (containerRef.current) {
                  if (spriteRef.current) spriteRef.current.visible = false;
                  if (jumpSpriteRef.current) jumpSpriteRef.current.visible = false;
                  if (fireSpriteRef.current) fireSpriteRef.current.visible = false;
                  
                  // Önce varsa eski death sprite'ı kaldır
                  if (deathSpriteRef.current && deathSpriteRef.current !== deathSprite) {
                    containerRef.current.removeChild(deathSpriteRef.current);
                  }
                  
                  containerRef.current.addChild(deathSprite);
                }
                
                console.log("Death sprite oluşturuldu ve eklendi");
                
                // Animasyonu oynat ve bitince 1. karede kal
                deathSprite.onComplete = () => {
                  if (deathSprite && !deathSprite.destroyed) {
                    console.log("Death animasyonu tamamlandı");
                    deathSprite.gotoAndStop(1);
                    deathSprite.visible = true;
                    deathSprite.alpha = 1;
                    
                    // Container'ı güncelle
                    if (containerRef.current) {
                      containerRef.current.setChildIndex(deathSprite, containerRef.current.children.length - 1);
                    }
                  }
                };
                
                console.log("death çalıştı");
                deathSprite.play();
              });
          });
        }
      }
        return;
      }
      
      // Ekran dışına çıkma kontrolü
      if (arrow.x < -50 || arrow.x > (appRef.current?.screen.width + 50) || 
          arrow.y < -50 || arrow.y > (appRef.current?.screen.height + 50)) {
        
        // Önce ticker'dan kaldır
        if (appRef.current?.ticker) {
          appRef.current.ticker.remove(updateArrow);
        }
        
        // Sonra oku listeden çıkar
        arrowsRef.current = arrowsRef.current.filter(a => a !== arrow);
        
        // En son oku temizle (eğer hala yok edilmediyse)
        if (!arrow.destroyed && mainContainerRef.current) {
          try {
            mainContainerRef.current.removeChild(arrow);
            arrow.destroy();
          } catch (error) {
            console.warn("Ok temizlenirken hata:", error);
          }
        }
      }
    };
    
    appRef.current.ticker.add(updateArrow);
  };
  

  // Okların oluşturulmasını durdur
  const stopArrowSpawning = () => {
    if (arrowSpawnIntervalRef.current) {
      clearInterval(arrowSpawnIntervalRef.current);
      arrowSpawnIntervalRef.current = null;
    }
    
    // Mevcut okları temizle
    arrowsRef.current.forEach(arrow => {
      if (mainContainerRef.current && !arrow.destroyed) {
        try {
          mainContainerRef.current.removeChild(arrow);
          arrow.destroy();
        } catch (error) {
          console.warn("Ok temizlenirken hata:", error);
        }
      }
    });
    arrowsRef.current = [];
  };

  // İşlem kuyruğunu işleyen fonksiyon
  const processQueue = async () => {
    if (isProcessingQueueRef.current || txQueueRef.current.length === 0) return;
    
    // Relayer havuzu kontrolü
    if (!relayerPoolRef.current || relayerPoolRef.current.length === 0) {
      console.error("Relayer havuzu henüz hazır değil");
      return;
    }
    
    isProcessingQueueRef.current = true;
    
    while (txQueueRef.current.length > 0) {
      const tx = txQueueRef.current[0];
      
      // Relayer seç
      let selectedRelayerIndex = currentRelayerIndexRef.current;
      let retryCount = 0;
      const maxRetries = relayerPoolRef.current.length; // Mevcut relayer sayısı kadar deneme
      
      while (retryCount < maxRetries) {
        const currentRelayer = relayerPoolRef.current[selectedRelayerIndex];
        if (currentRelayer && !currentRelayer.isProcessing) {
          break;
        }
        selectedRelayerIndex = (selectedRelayerIndex + 1) % relayerPoolRef.current.length;
        retryCount++;
      }
      
      if (retryCount === maxRetries) {
        console.error("Tüm relayerlar meşgul, işlem bekletiliyor...");
        break;
      }
      
      const selectedRelayer = relayerPoolRef.current[selectedRelayerIndex];
      if (!selectedRelayer) {
        console.error("Seçilen relayer bulunamadı");
        break;
      }
      
      selectedRelayer.isProcessing = true;
      
      try {
        if (!window.ethereum) {
          throw new Error("Ethereum provider bulunamadı");
        }
        
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const relayerWallet = new ethers.Wallet(selectedRelayer.key, provider);
        
        const gameContract = new ethers.Contract(
          process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS!,
          gameContractABI,
          relayerWallet
        );
        
        const txParams = {
          gasLimit: 300000,
          gasPrice: await provider.getGasPrice(),
          nonce: selectedRelayer.nonce
        };
        
        console.log(`İşlem gönderiliyor (Relayer ${selectedRelayerIndex + 1})`);
        const txResponse = await gameContract.bossHit(tx.account, txParams);
        await txResponse.wait();
        
        // İşlem başarılı, relayer nonce'unu artır
        selectedRelayer.nonce++;
        
        // TX sayacını artır
        txCounterRef.current++;
        if (txCounterTextRef.current) {
          txCounterTextRef.current.text = txCounterRef.current.toString();
        }
        
        console.log(`Boss hit transaction başarılı (Relayer ${selectedRelayerIndex + 1})`);
        
      } catch (error: any) {
        console.error(`Relayer ${selectedRelayerIndex + 1} hatası:`, error);
        
        if (error.code === 'NONCE_EXPIRED' || error.code === 'REPLACEMENT_UNDERPRICED') {
          // Nonce sorununda nonce'u güncelle
          try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const wallet = new ethers.Wallet(selectedRelayer.key, provider);
            selectedRelayer.nonce = await wallet.getTransactionCount();
          } catch (e) {
            console.error("Nonce güncellenirken hata:", e);
          }
        }
      } finally {
        if (selectedRelayer) {
          selectedRelayer.isProcessing = false;
        }
      }
      
      // İşlemi kuyruktan çıkar
      txQueueRef.current.shift();
      
      // Sonraki relayer'a geç
      currentRelayerIndexRef.current = (selectedRelayerIndex + 1) % relayerPoolRef.current.length;
      
      // 1 saniye bekle
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    isProcessingQueueRef.current = false;
  };



  // Boss'a vuruş işlemini kuyruğa ekleyen fonksiyon
  const sendBossHit = async () => {
    if (!account) return;
    
    try {
      await relayerService.addToQueue(account);
      // TX sayacını artır
      txCounterRef.current++;
      if (txCounterTextRef.current) {
        txCounterTextRef.current.text = txCounterRef.current.toString();
      }
    } catch (error) {
      console.error("Boss hit işlemi sırasında hata:", error);
    }
  };

  const sendrewardToken = async () => {
    if (!account) return;
    
    try {
      const tokenAmount = 1;
      await relayerService.addTokenRewardToQueue(tokenAmount, account);
      // TX sayacını artır
      txCounterRef.current++;
      if (txCounterTextRef.current) {
        txCounterTextRef.current.text = txCounterRef.current.toString();
      }
    } catch (error) {
      console.error("Reward token işlemi sırasında hata:", error);
    }
  };

  // Component mount olduğunda relayer durumunu kontrol et
  useEffect(() => {
    const checkRelayerStatus = async () => {
      try {
        const status = await relayerService.getStatus();
        console.log('Relayer havuzu durumu:', status);
      } catch (error) {
        console.error('Relayer durumu kontrol edilirken hata:', error);
      }
    };

    checkRelayerStatus();
  }, []);

  // Sayaç için referanslar
  const timerTextRef = useRef<PIXI.Text | null>(null);
  const countdownRef = useRef<number>(30);
  let countdownInterval: NodeJS.Timeout;

  // Sayacı başlat
  const startCountdown = () => {
    countdownRef.current = 30;

    // Sayaç metnini oluştur
    if (!timerTextRef.current && appRef.current) {
      timerTextRef.current = new PIXI.Text("30", {
        fontFamily: "Arial",
        fontSize: 36,
        fill: 0x00ff00,
        align: "center",
        stroke: 0x000000,
        strokeThickness: 4,
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4,
        dropShadowAngle: Math.PI / 6,
        dropShadowDistance: 6,
      });

      // Ekranın üst ortasına yerleştir
      timerTextRef.current.anchor.set(0.5);
      timerTextRef.current.x = window.innerWidth / 2;
      timerTextRef.current.y = 50;
      
      appRef.current.stage.addChild(timerTextRef.current);
    }

    // Önceki interval'i temizle
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    // Her saniye sayacı güncelle
    countdownInterval = setInterval(() => {
      if (countdownRef.current > 0) {
        countdownRef.current -= 1;
        if (timerTextRef.current) {
          timerTextRef.current.text = countdownRef.current.toString();
        }
      } else {
        // Süre dolduğunda
        if (timerTextRef.current && appRef.current) {
          appRef.current.stage.removeChild(timerTextRef.current);
          timerTextRef.current = null;
        }
        clearInterval(countdownInterval);
      }
    }, 1000);
  };

  // Oyun başladığında sayacı başlat
  useEffect(() => {
    if (appRef.current && !isDead) {
      startCountdown();
    }

    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      if (timerTextRef.current && appRef.current) {
        appRef.current.stage.removeChild(timerTextRef.current);
        timerTextRef.current = null;
      }
    };
  }, []);



  return (
    <div>
      {isGamePage && (
        <>
          <div
            ref={pixiContainer}
            style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}
            className="overflow-hidden"
          />
          {error && (
            <div className="text-red-500 mt-2 text-center fixed bottom-4 left-1/2 transform -translate-x-1/2">
              {error}
            </div>
          )}
          
          {showGameOver && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'radial-gradient(circle at center, rgba(0, 0, 0, 0.9) 0%, rgba(20, 0, 0, 0.95) 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000,
                animation: 'fadeIn 1s ease-in-out'
              }}
            >
              <style>
                {`
                  @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                  }
        
                  @keyframes pulseButton {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                  }
                `}
              </style>
              
              <div 
                style={{
                  fontSize: '120px',
                  fontFamily: 'Impact, sans-serif',
                  color: '#ff0000',
                  textTransform: 'uppercase',
                  letterSpacing: '4px',
                  marginBottom: '40px',
                  textAlign: 'center',
                  lineHeight: '1',
                  textShadow: '0 0 2px #ff0000, 0 0 4px #ff0000',
          
                }}
              >
                Game Over
              </div>
              <div 
                style={{
                  
                  padding: '40px',
           
                  maxWidth: '400px',
                  width: '90%'
                }}
              >
                <button
                  onClick={restartGame}
                  style={{
                    width: '100%',
                    padding: '20px',
                    fontSize: '24px',
                    fontFamily: 'Impact, sans-serif',
                    color: '#ffffff',
                    background: 'linear-gradient(45deg, #ff0000, #cc0000)',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    animation: 'pulseButton 2s infinite',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    boxShadow: '0 0 20px rgba(255, 0, 0, 0.3)',
                    marginBottom: '20px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(255, 0, 0, 0.5)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.3)';
                  }}
                >
                  Restart Game
                </button>
                
                <div style={{ marginTop: '30px' }}>
                  <Social />
                </div>
              </div>
            </div>
          )}
         
        </>
      )}
    </div>
  );
};

export default PixiSprite;      
