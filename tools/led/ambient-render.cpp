// Offline host build of the actual board stages. No serial, networking or desk.
// Build with -I<firmware src/ambient>. Skip config.h's hardware/network settings;
// these output constants come from the audited Desk 02 config, not credentials.
#define CONFIG_H
#define NUM_SEGMENTS 8
#define MAX_PIXELS_PER_STRIP 16
#define MA_PER_PIXEL_RGB 48
#define MA_PER_PIXEL_W 16
#include <cstdint>
const uint16_t STRIP_LENGTHS[8]={14,14,15,14,14,11,11,13};
#include "Ambient.hpp"
#include <iostream>
#include <vector>
int main() {
    Ambient::reset(); uint32_t index=0;
    for (;;) {
        uint16_t size=0;
        if(!std::cin.read(reinterpret_cast<char*>(&size),2))break;
        if(size>Ambient::kMaxPayload)return 2;
        std::vector<uint8_t> bytes(size);
        if(!std::cin.read(reinterpret_cast<char*>(bytes.data()),size))return 3;
        const uint32_t now=1+uint32_t(index*1000.0/60.0);
        if(Ambient::accept(bytes.data(),size,now)!=Ambient::V_OK)return 4;
        Ambient::step(now,255,8000);
        uint8_t pixels[16][4];
        for(uint8_t s=0;s<8;s++){
            Ambient::emit(s,255,pixels);
            std::cout.write(reinterpret_cast<char*>(pixels),STRIP_LENGTHS[s]*4);
        }
        index++;
    }
    return 0;
}
