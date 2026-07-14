#include <iostream>
#include <string>

int main() {
    std::string name;
    std::getline(std::cin, name);
    if (name.empty()) name = "world";
    std::cout &lt;&lt; "hello, " &lt;&lt; name &lt;&lt; "!" &lt;&lt; std::endl;
    return 0;
}